"""CP-SAT model generating a monthly schedule.

Mirrors the TypeScript validator (apps/web/src/lib/domain/validator.ts): what the
validator calls a hard rule is a hard constraint here, staffing and a few
fairness rules are weighted objectives so that a schedule is always proposed and
the validator reports what could not be satisfied.

Times of day are minutes from midnight (0-1440); weekdays are ISO (1 = Monday).
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from ortools.sat.python import cp_model

from .schemas import (
    Assignment,
    Employee,
    Rule,
    SolveRequest,
    SolveResponse,
    StaffingOverride,
    StaffingRequirement,
    Stats,
)

REST_DAY = "OF"
TIME_OFF_IN_LIEU = "TL"
BIRTHDAY_LEAVE = "BD"
ANNUAL_LEAVE = "AL"
RULE_DEFAULTS = {
    "max_consecutive_work_days": 6,
    "min_rest_between_shifts_hours": 11,
    "weekend_off_per_month": 1,
    "birthday_off": True,
    "two_rest_days_per_week": True,
    "approved_leave_is_fixed": True,
}


def iso(d: date) -> str:
    return d.isoformat()


def parse(d: str) -> date:
    return date.fromisoformat(d)


@dataclass
class RuleValue:
    value: object
    active: bool
    hard: bool


def resolve_rule(rules: list[Rule], code: str, employee: Employee) -> RuleValue:
    """Employee rule > section rule > global rule > built-in default."""
    candidates = [r for r in rules if r.code == code]
    match = (
        next((r for r in candidates if r.scope == "employee" and r.employee_id == employee.id), None)
        or next(
            (
                r
                for r in candidates
                if r.scope == "section" and r.section_id == employee.primary_section_id
            ),
            None,
        )
        or next((r for r in candidates if r.scope == "global"), None)
    )
    if match is None:
        return RuleValue(RULE_DEFAULTS.get(code), True, True)
    value = match.value.get("value") if isinstance(match.value, dict) else match.value
    return RuleValue(value if value is not None else RULE_DEFAULTS.get(code), match.is_active, match.is_hard)


@dataclass
class Shift:
    id: str
    section_id: str
    code: str
    paid: int
    first_start: int
    last_end: int
    periods: list[tuple[int, int]]


@dataclass
class Cell:
    """One employee/day: either fixed to a value or a set of boolean variables."""

    fixed: str | None = None  # shift id or day code
    vars: dict[str, cp_model.IntVar] = field(default_factory=dict)


def solve(req: SolveRequest) -> SolveResponse:
    m = cp_model.CpModel()
    w = req.options.weights
    penalties: list[cp_model.LinearExprT] = []

    days = [date(req.year, req.month, d) for d in range(1, calendar.monthrange(req.year, req.month)[1] + 1)]
    first, last = days[0], days[-1]

    shifts: dict[str, Shift] = {}
    for st in req.shift_types:
        periods = sorted((p.start_minute, p.end_minute) for p in st.periods)
        paid = sum(p.end_minute - p.start_minute - p.unpaid_break_minutes for p in st.periods)
        shifts[st.id] = Shift(st.id, st.section_id, st.code, paid, periods[0][0], periods[-1][1], periods)
    active_shifts = {s.id for s in req.shift_types if s.is_active}
    day_kind = {d.code: d.kind for d in req.day_codes}
    credits = {d.code for d in req.day_codes if d.credits_time}
    due_codes = {d.code for d in req.day_codes if d.is_due_day}

    employees = [e for e in req.employees if e.status == "active"]

    def employed(e: Employee, d: date) -> bool:
        return (e.hired_on is None or iso(d) >= e.hired_on) and (e.left_on is None or iso(d) <= e.left_on)

    locked = {(a.employee_id, a.date): a.shift_type_id or a.day_code for a in req.locked_assignments}
    tail = {(a.employee_id, a.date): a.shift_type_id or a.day_code for a in req.previous_assignments}

    # ------------------------------------------------------------------ cells

    cells: dict[tuple[str, date], Cell] = {}
    for e in employees:
        fixed_rest = {f.weekday for f in e.fixed_days_off}
        eligible = [el.shift_type_id for el in e.eligibility if el.shift_type_id in active_shifts]
        birthday_rule = resolve_rule(req.rules, "birthday_off", e)
        leave_rule = resolve_rule(req.rules, "approved_leave_is_fixed", e)
        birthday = None
        if e.birthday_month == req.month and e.birthday_day and birthday_rule.active and birthday_rule.value:
            birthday = date(req.year, req.month, min(e.birthday_day, last.day))
        for d in days:
            if not employed(e, d):
                continue
            cell = Cell()
            absence = next(
                (a for a in req.absences if a.employee_id == e.id and a.start_date <= iso(d) <= a.end_date),
                None,
            )
            if (e.id, iso(d)) in locked:
                cell.fixed = locked[(e.id, iso(d))]
            elif absence and leave_rule.active:
                # Leave ranges are calendar ranges: fixed rest weekdays stay OF.
                is_rest = d.isoweekday() in fixed_rest
                cell.fixed = REST_DAY if is_rest and absence.day_code == ANNUAL_LEAVE else absence.day_code
            elif d == birthday:
                cell.fixed = BIRTHDAY_LEAVE
            else:
                for value in [*eligible, REST_DAY, TIME_OFF_IN_LIEU]:
                    cell.vars[value] = m.new_bool_var(f"x_{e.id[:8]}_{d.day}_{value[:8]}")
                m.add_exactly_one(cell.vars.values())
            cells[(e.id, d)] = cell

    def var(e: Employee, d: date, value: str):
        """1/0 constant or the boolean variable for `value` in a month cell."""
        cell = cells.get((e.id, d))
        if cell is None:
            return 0
        if cell.fixed is not None:
            return 1 if cell.fixed == value else 0
        return cell.vars.get(value, 0)

    def work(e: Employee, d: date):
        if d < first:
            value = tail.get((e.id, iso(d)))
            return 1 if value in shifts else 0
        cell = cells.get((e.id, d))
        if cell is None:
            return 0
        if cell.fixed is not None:
            return 1 if cell.fixed in shifts else 0
        return sum(v for k, v in cell.vars.items() if k in shifts)

    def rest(e: Employee, d: date):
        if d < first:
            value = tail.get((e.id, iso(d)))
            return 1 if value and day_kind.get(value) == "rest" else 0
        cell = cells.get((e.id, d))
        if cell is not None and cell.fixed is not None:
            return 1 if day_kind.get(cell.fixed) == "rest" else 0
        return var(e, d, REST_DAY)

    def shift_options(e: Employee, d: date) -> list[tuple[str, object]]:
        """(shift id, 0/1 or variable) pairs that may be worked on day d."""
        if d < first:
            value = tail.get((e.id, iso(d)))
            return [(value, 1)] if value in shifts else []
        cell = cells.get((e.id, d))
        if cell is None:
            return []
        if cell.fixed is not None:
            return [(cell.fixed, 1)] if cell.fixed in shifts else []
        return [(k, v) for k, v in cell.vars.items() if k in shifts]

    def iso_week(d: date) -> tuple[int, int]:
        y, wk, _ = d.isocalendar()
        return y, wk

    weeks: dict[tuple[int, int], list[date]] = defaultdict(list)
    for d in days:
        weeks[iso_week(d)].append(d)

    # ------------------------------------------------------------------ hard rules

    for e in employees:
        # Rest between shifts (also across midnight and from the previous month).
        rest_rule = resolve_rule(req.rules, "min_rest_between_shifts_hours", e)
        if rest_rule.active:
            min_rest = int(float(rest_rule.value) * 60)
            for d in days:
                for s1, v1 in shift_options(e, d - timedelta(days=1)):
                    for s2, v2 in shift_options(e, d):
                        if 1440 + shifts[s2].first_start - shifts[s1].last_end < min_rest:
                            if isinstance(v1, int) and isinstance(v2, int):
                                continue  # both fixed: nothing to decide
                            m.add(v1 + v2 <= 1)

        # Maximum consecutive working days, counting the previous month's tail.
        consecutive = resolve_rule(req.rules, "max_consecutive_work_days", e)
        if consecutive.active:
            n = int(consecutive.value)
            span = [first - timedelta(days=i) for i in range(n, 0, -1)] + days
            for i in range(len(span) - n):
                window = span[i : i + n + 1]
                if window[-1] >= first:
                    m.add(sum(work(e, d) for d in window) <= n)

        # Two rest days (OF) per ISO week, at most two chosen by the solver.
        two_rest = resolve_rule(req.rules, "two_rest_days_per_week", e)
        for (y, wk), week_days in weeks.items():
            if not any(cells.get((e.id, d)) and cells[(e.id, d)].fixed is None for d in week_days):
                continue
            monday = week_days[0] - timedelta(days=week_days[0].isoweekday() - 1)
            full = [monday + timedelta(days=i) for i in range(7)]
            known = [
                d
                for d in full
                if (first <= d <= last and (e.id, d) in cells) or (d < first and (e.id, iso(d)) in tail)
            ]
            unknown = 7 - len(known)
            m.add(sum(var(e, d, REST_DAY) for d in week_days) <= 2)
            if two_rest.active and two_rest.value and unknown < 2:
                has_work = m.new_bool_var(f"hw_{e.id[:8]}_{wk}")
                for d in known:
                    m.add(work(e, d) <= has_work)
                m.add(sum(rest(e, d) for d in known) + unknown >= 2 * has_work)

        # Weekly shift limits.
        for el in e.eligibility:
            for week_days in weeks.values():
                count = sum(var(e, d, el.shift_type_id) for d in week_days)
                if el.max_per_week is not None:
                    m.add(count <= el.max_per_week)
                if el.exact_per_week is not None:
                    complete = len(week_days) == 7 and all(
                        (cell := cells.get((e.id, d))) is not None
                        and not (cell.fixed and day_kind.get(cell.fixed) == "absence")
                        for d in week_days
                    )
                    m.add(count <= el.exact_per_week)
                    if complete:
                        gap = m.new_int_var(0, 7, "")
                        m.add(gap == el.exact_per_week - count)
                        penalties.append(w.exact_per_week * gap)

    # Unavailabilities: no shift overlapping the unavailable window.
    by_id = {e.id: e for e in employees}
    for u in req.unavailabilities:
        e = by_id.get(u.employee_id)
        if e is None or not (iso(first) <= u.date <= iso(last)):
            continue
        d = parse(u.date)
        start = u.start_minute if u.start_minute is not None else 0
        end = u.end_minute if u.end_minute is not None else 1440
        for s, v in shift_options(e, d):
            if any(ps < end and pe > start for ps, pe in shifts[s].periods) and not isinstance(v, int):
                m.add(v == 0)

    # ------------------------------------------------------------------ soft rules

    weekends = [(d, d + timedelta(days=1)) for d in days if d.isoweekday() == 6 and d + timedelta(days=1) <= last]
    weekend_off: dict[tuple[str, date], object] = {}
    for e in employees:
        for sat, sun in weekends:
            if (e.id, sat) not in cells or (e.id, sun) not in cells:
                continue
            off = m.new_bool_var("")
            m.add(off <= 1 - work(e, sat))
            m.add(off <= 1 - work(e, sun))
            m.add(off >= 1 - work(e, sat) - work(e, sun))
            weekend_off[(e.id, sat)] = off

    for e in employees:
        rule = resolve_rule(req.rules, "weekend_off_per_month", e)
        if e.requires_monthly_weekend_off and rule.active:
            offs = [weekend_off[(e.id, sat)] for sat, _ in weekends if (e.id, sat) in weekend_off]
            if offs:
                missing = m.new_int_var(0, len(offs), "")
                m.add(missing >= int(rule.value) - sum(offs))
                penalties.append(w.weekend_off * missing)

    for r in req.relations:
        a, b = by_id.get(r.employee_a_id), by_id.get(r.employee_b_id)
        if a is None or b is None:
            continue
        if r.type == "same_days_off":
            for d in days:
                if (a.id, d) not in cells or (b.id, d) not in cells:
                    continue
                for x, y in ((a, b), (b, a)):
                    p = m.new_bool_var("")
                    m.add(rest(x, d) + work(y, d) - 1 <= p)
                    penalties.append(w.same_days_off * p)
        else:
            for sat, _ in weekends:
                oa, ob = weekend_off.get((a.id, sat)), weekend_off.get((b.id, sat))
                if oa is None or ob is None:
                    continue
                p = m.new_bool_var("")
                m.add(oa + ob - 1 <= p)
                penalties.append(w.different_weekend_off * p)

    # Staffing per date, section and shift (null = any shift of the section).
    for d in days:
        for section in req.sections:
            section_shifts = [s.id for s in req.shift_types if s.section_id == section.id]
            for shift_id, target in staffing_targets(req.staffing_requirements, req.staffing_overrides, section.id, d).items():
                ids = [shift_id] if shift_id else section_shifts
                count = sum(var(e, d, s) for e in employees for s in ids)
                if target[0] > 0:
                    short = m.new_int_var(0, target[0], "")
                    m.add(short >= target[0] - count)
                    penalties.append(w.staffing_short * short)
                if target[1] is not None:
                    over = m.new_int_var(0, len(employees), "")
                    m.add(over >= count - target[1])
                    penalties.append(w.staffing_over * over)

    # Monthly time off in lieu, fixed weekdays for rest, hour bank and shift preferences.
    balances = {b.employee_id: b.balance_minutes for b in req.hour_bank_balances}
    for e in employees:
        tl_count = sum(var(e, d, TIME_OFF_IN_LIEU) for d in days)
        tl_gap = m.new_int_var(0, len(days), "")
        m.add(tl_gap >= tl_count - e.monthly_tl_days)
        m.add(tl_gap >= e.monthly_tl_days - tl_count)
        penalties.append(w.tl_days * tl_gap)

        fixed_weekdays = {f.weekday for f in e.fixed_days_off}
        if fixed_weekdays:
            for d in days:
                v = var(e, d, REST_DAY)
                if not isinstance(v, int) and d.isoweekday() not in fixed_weekdays:
                    penalties.append(w.fixed_day_off_moved * v)

        # Monthly delta = worked + credited - expected, steered towards paying the
        # balance back (at most one contract day per month). Expected counts days with
        # a shift and days whose code is due; TL is due but credits nothing.
        daily = e.weekly_contract_minutes // 5
        employed_days = [d for d in days if (e.id, d) in cells]
        worked = sum(shifts[s].paid * v for d in employed_days for s, v in shift_options(e, d))
        credited = 0
        due_days = 0
        for d in employed_days:
            cell = cells[(e.id, d)]
            if cell.fixed is not None:
                credited += daily if cell.fixed in credits else 0
                due_days += 1 if cell.fixed in shifts or cell.fixed in due_codes else 0
            else:
                due_days += sum(v for k, v in cell.vars.items() if k in shifts or k in due_codes)
        delta = worked + credited - daily * due_days
        target = max(-daily, min(daily, -balances.get(e.id, 0)))
        dev = m.new_int_var(0, 100_000, "")
        m.add(dev >= delta - target)
        m.add(dev >= target - delta)
        half_hours = m.new_int_var(0, 4_000, "")
        m.add(30 * half_hours >= dev)
        penalties.append(w.hour_bank_per_half_hour * half_hours)

        for el in e.eligibility:
            cost = {"preferred": 0, "normal": w.normal_shift, "rare": w.rare_shift}[el.preference]
            if cost:
                penalties.append(cost * sum(var(e, d, el.shift_type_id) for d in days))

    m.minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = req.options.time_limit_seconds
    solver.parameters.num_workers = 8
    status = solver.solve(m)
    stats = Stats(
        wall_time_seconds=round(solver.wall_time, 2),
        conflicts=solver.num_conflicts,
        branches=solver.num_branches,
    )
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResponse(
            run_id=req.run_id,
            status="infeasible",
            stats=stats,
            infeasibility=[
                {
                    "rule": "hard_rules",
                    "message": "No schedule satisfies the hard rules together with the locked cells and approved absences.",
                }
            ],
        )

    assignments: list[Assignment] = []
    for (employee_id, d), cell in cells.items():
        value = cell.fixed
        if value is None:
            value = next(k for k, v in cell.vars.items() if solver.value(v))
        is_shift = value in shifts
        assignments.append(
            Assignment(
                employee_id=employee_id,
                date=iso(d),
                shift_type_id=value if is_shift else None,
                day_code=None if is_shift else value,
                is_locked=(employee_id, iso(d)) in locked,
            )
        )
    return SolveResponse(
        run_id=req.run_id,
        status="optimal" if status == cp_model.OPTIMAL else "feasible",
        assignments=assignments,
        objective=solver.objective_value,
        stats=stats,
    )


def staffing_targets(
    requirements: list[StaffingRequirement],
    overrides: list[StaffingOverride],
    section_id: str,
    d: date,
) -> dict[str | None, tuple[int, int | None]]:
    """Same precedence as the validator: date override > weekday rule > every-day rule."""
    targets: dict[str | None, tuple[int, int | None, bool]] = {}
    for r in requirements:
        if r.section_id != section_id:
            continue
        if (r.valid_from and iso(d) < r.valid_from) or (r.valid_to and iso(d) > r.valid_to):
            continue
        if r.weekday is not None and r.weekday != d.isoweekday():
            continue
        specific = r.weekday is not None
        existing = targets.get(r.shift_type_id)
        if existing and existing[2] and not specific:
            continue
        targets[r.shift_type_id] = (r.min_staff, r.max_staff, specific)
    for o in overrides:
        if o.section_id == section_id and o.date == iso(d):
            targets[o.shift_type_id] = (o.min_staff, o.max_staff, True)
    return {k: (v[0], v[1]) for k, v in targets.items()}
