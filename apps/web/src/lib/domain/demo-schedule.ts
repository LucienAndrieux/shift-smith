import {
  addDays,
  type IsoDate,
  isoWeeksOfMonth,
  monthDates,
  toIsoDate,
  weekday,
} from "./calendar";
import { BIRTHDAY_LEAVE, REST_DAY, TIME_OFF_IN_LIEU } from "./day-codes";
import { computeShiftDuration } from "./durations";
import { prefillAssignments } from "./prefill";
import { resolveRule } from "./rules";
import {
  type SeedFile,
  type SeedPlan,
  seedPlanToScheduleInput,
} from "./seed-mapping";
import type {
  Assignment,
  Employee,
  ScheduleInput,
  ShiftEligibility,
} from "./types";
import {
  type Violation,
  validateSchedule,
  violationIdentity,
} from "./validator";

/**
 * Demo reference schedule generator (scripts/generate-demo-schedule.ts and the demo
 * reset job). Deterministic: same plan, same output.
 *
 * 1. Prefill fixed days off, approved absences and birthdays.
 * 2. Day by day, give every remaining working day a shift: staffing minimums first
 *    (scarcest shift first), then preferences, respecting rest between shifts and
 *    weekly shift limits.
 * 3. Free a full weekend for employees who need one and place the monthly time off
 *    in lieu, keeping a change only when the validator finds no new error.
 * 4. Introduce a handful of deliberate mistakes so the validator has something to
 *    show in the demo.
 */

type Cell = Pick<Assignment, "shiftTypeId" | "dayCode">;

export interface DemoSchedule {
  year: number;
  month: number;
  /** section code → employee name → one code per day (shift code or day code). */
  grids: Record<string, Record<string, string[]>>;
  mistakes: string[];
  /** Violations before the deliberate mistakes. */
  cleanViolations: Violation[];
}

export function generateDemoSchedule(
  plan: SeedPlan,
  target: { year: number; month: number } = plan.demoMonths[0],
  /** false = a clean schedule (the later demo months). */
  {
    withMistakes = true,
    previous,
  }: {
    withMistakes?: boolean;
    /** The previous month, so rest and weekly limits hold across the boundary. */
    previous?: DemoSchedule;
  } = {},
): DemoSchedule {
  const base = seedPlanToScheduleInput(plan, target);
  const dates = monthDates(target.year, target.month);
  const employees = base.employees.filter((e) => e.status === "active");

  const shifts = new Map(
    base.shiftTypes.map((s) => [
      s.id,
      { ...s, ...computeShiftDuration(s.periods) },
    ]),
  );
  const minRestMinutes =
    resolveRule(base.rules, "min_rest_between_shifts_hours").value.value * 60;
  const PREFERENCE_COST = { preferred: 0, normal: 1, rare: 3 } as const;

  // ---------------------------------------------------------------- grid state

  const grid = new Map<string, Cell>();
  const locked = new Set<string>();
  const key = (employeeId: string, date: IsoDate) => `${employeeId}|${date}`;
  const cellOf = (employeeId: string, date: IsoDate) =>
    grid.get(key(employeeId, date));
  const setCell = (employeeId: string, date: IsoDate, cell: Cell) =>
    grid.set(key(employeeId, date), cell);
  const work = (shiftTypeId: string): Cell => ({ shiftTypeId, dayCode: null });
  const code = (dayCode: string): Cell => ({ shiftTypeId: null, dayCode });

  for (const a of prefillAssignments(base)) {
    setCell(a.employeeId, a.date, a);
    if (a.isLocked || a.dayCode !== REST_DAY)
      locked.add(key(a.employeeId, a.date));
  }
  // Last week of the previous month: fixed context for rest, weekly counts and
  // the validator (dates before the month are read as the previous-month tail).
  if (previous) {
    const days = monthDates(previous.year, previous.month);
    for (const [section, rows] of Object.entries(previous.grids)) {
      for (const [name, codes] of Object.entries(rows)) {
        codes.forEach((value, i) => {
          if (i < days.length - 7) return;
          const shift = base.shiftTypes.find(
            (t) => t.sectionId === section && t.code === value,
          );
          setCell(name, days[i], shift ? work(shift.id) : code(value));
          locked.add(key(name, days[i]));
        });
      }
    }
  }

  function input(): ScheduleInput {
    return {
      ...base,
      assignments: [...grid].map(([k, cell]) => {
        const [employeeId, date] = k.split("|");
        return { employeeId, date, ...cell, isLocked: false };
      }),
    };
  }

  const errorIds = (i: ScheduleInput) =>
    new Set(
      validateSchedule(i)
        .violations.filter((v) => v.severity === "error")
        .map(violationIdentity),
    );
  const warningCount = (i: ScheduleInput) =>
    validateSchedule(i).violations.filter((v) => v.severity === "warning")
      .length;

  /**
   * Runs `mutate` (which may only touch the given employees) and keeps the result
   * when `accept(before, after)` says so; otherwise restores their cells.
   */
  function tryChanges(
    employeeIds: string[],
    mutate: () => boolean,
    accept: (before: ScheduleInput, after: ScheduleInput) => boolean,
  ): boolean {
    const before = input();
    const saved = employeeIds.flatMap((id) =>
      dates.map((d) => [key(id, d), grid.get(key(id, d))] as const),
    );
    if (mutate() && accept(before, input())) return true;
    for (const [k, cell] of saved) {
      if (cell) grid.set(k, cell);
      else grid.delete(k);
    }
    return false;
  }

  const noNewError = (before: ScheduleInput, after: ScheduleInput) => {
    const old = errorIds(before);
    return [...errorIds(after)].every((id) => old.has(id));
  };
  const fewerErrors = (before: ScheduleInput, after: ScheduleInput) =>
    noNewError(before, after) && errorIds(after).size < errorIds(before).size;

  // ---------------------------------------------------------------- shift choice

  const weekOf = (date: IsoDate) =>
    isoWeeksOfMonth(target.year, target.month).find((w) =>
      w.dates.includes(date),
    )?.dates ?? [date];

  function restOk(employeeId: string, date: IsoDate, shiftTypeId: string) {
    const shift = shifts.get(shiftTypeId);
    if (!shift) return false;
    const before = cellOf(employeeId, addDays(date, -1))?.shiftTypeId;
    const after = cellOf(employeeId, addDays(date, 1))?.shiftTypeId;
    const prev = before ? shifts.get(before) : undefined;
    const next = after ? shifts.get(after) : undefined;
    if (
      prev &&
      1440 + shift.firstStartMinute - prev.lastEndMinute < minRestMinutes
    )
      return false;
    if (
      next &&
      1440 + next.firstStartMinute - shift.lastEndMinute < minRestMinutes
    )
      return false;
    return true;
  }

  function weeklyCount(employeeId: string, date: IsoDate, shiftTypeId: string) {
    return weekOf(date).filter(
      (d) => d !== date && cellOf(employeeId, d)?.shiftTypeId === shiftTypeId,
    ).length;
  }

  function allowed(e: Employee, date: IsoDate, el: ShiftEligibility) {
    if (!restOk(e.id, date, el.shiftTypeId)) return false;
    const count = weeklyCount(e.id, date, el.shiftTypeId);
    if (el.maxPerWeek !== null && count >= el.maxPerWeek) return false;
    if (el.exactPerWeek !== null && count >= el.exactPerWeek) return false;
    return true;
  }

  function cost(e: Employee, date: IsoDate, el: ShiftEligibility) {
    const yesterday = cellOf(e.id, addDays(date, -1))?.shiftTypeId;
    return (
      PREFERENCE_COST[el.preference] +
      (yesterday === el.shiftTypeId ? -0.5 : 0) +
      weeklyCount(e.id, date, el.shiftTypeId) * 0.1
    );
  }

  /** Best allowed shift for an employee on a date, optionally among `only`. */
  function bestShift(e: Employee, date: IsoDate, only?: Set<string>) {
    // A shift required an exact number of times per week is forced once the
    // remaining working days of the week are just enough.
    for (const el of e.eligibility) {
      if (el.exactPerWeek === null) continue;
      const week = weekOf(date);
      const done = weeklyCount(e.id, date, el.shiftTypeId);
      const open = week.filter((d) => d >= date && !cellOf(e.id, d)).length;
      if (el.exactPerWeek - done >= open && allowed(e, date, el)) {
        return !only || only.has(el.shiftTypeId) ? el.shiftTypeId : null;
      }
    }
    const options = e.eligibility
      .filter(
        (el) => (!only || only.has(el.shiftTypeId)) && allowed(e, date, el),
      )
      .sort((a, b) => cost(e, date, a) - cost(e, date, b));
    return options[0]?.shiftTypeId ?? null;
  }

  // ---------------------------------------------------------------- 2. greedy fill

  for (const date of dates) {
    for (const section of base.sections) {
      const free = employees.filter(
        (e) => e.primarySectionId === section.id && !cellOf(e.id, date),
      );
      const sectionShifts = base.shiftTypes
        .filter((s) => s.sectionId === section.id)
        .map((s) => s.id);
      const slots = base.staffingRequirements
        .filter((r) => r.sectionId === section.id && r.minStaff > 0)
        .map((r) => ({
          shifts: new Set(r.shiftTypeId ? [r.shiftTypeId] : sectionShifts),
          min: r.minStaff,
        }))
        .sort(
          (a, b) =>
            free.filter((e) => bestShift(e, date, a.shifts)).length -
            free.filter((e) => bestShift(e, date, b.shifts)).length,
        );
      // Employees who still owe a fixed number of another shift this week go last.
      const owesOther = (e: Employee, only: Set<string>) =>
        e.eligibility.some(
          (el) =>
            el.exactPerWeek !== null &&
            !only.has(el.shiftTypeId) &&
            weeklyCount(e.id, date, el.shiftTypeId) < el.exactPerWeek,
        )
          ? 1
          : 0;
      for (const slot of slots) {
        for (let n = 0; n < slot.min; n++) {
          const pick = free
            .filter((e) => !cellOf(e.id, date))
            .map((e) => ({ e, shift: bestShift(e, date, slot.shifts) }))
            .filter((p) => p.shift !== null)
            .sort(
              (a, b) =>
                owesOther(a.e, slot.shifts) - owesOther(b.e, slot.shifts) ||
                a.e.eligibility.length - b.e.eligibility.length ||
                a.e.displayName.localeCompare(b.e.displayName),
            )[0];
          if (pick?.shift) setCell(pick.e.id, date, work(pick.shift));
        }
      }
      for (const e of free) {
        if (cellOf(e.id, date)) continue;
        const shift = bestShift(e, date);
        setCell(e.id, date, shift ? work(shift) : code(REST_DAY));
      }
    }
  }

  // ---------------------------------------------------------------- 3. weekends and TL

  const weekends = dates
    .filter((d) => weekday(d) === 6 && dates.includes(addDays(d, 1)))
    .map((sat) => [sat, addDays(sat, 1)] as const);

  const hasWeekendOff = (e: Employee) =>
    weekends.some(([sat, sun]) =>
      [sat, sun].every((d) => cellOf(e.id, d)?.dayCode),
    );

  /**
   * Gives `e` (and a partner who must share rest days) the weekend off, turning
   * `giveBack` of the fixed rest days of that week into working days.
   */
  function freeWeekend(
    group: Employee[],
    [sat, sun]: readonly [IsoDate, IsoDate],
    giveBack: "both" | "first" | "second" | "none",
  ) {
    for (const e of group) {
      if (locked.has(key(e.id, sat)) || locked.has(key(e.id, sun)))
        return false;
      const fixed = new Set(e.fixedDaysOff.map((f) => f.weekday));
      const restDays = weekOf(sat).filter(
        (d) =>
          fixed.has(weekday(d)) &&
          cellOf(e.id, d)?.dayCode === REST_DAY &&
          !locked.has(key(e.id, d)),
      );
      setCell(e.id, sat, code(REST_DAY));
      setCell(e.id, sun, code(REST_DAY));
      const back =
        giveBack === "both"
          ? restDays
          : giveBack === "first"
            ? restDays.slice(0, 1)
            : giveBack === "second"
              ? restDays.slice(1)
              : [];
      for (const d of back) {
        grid.delete(key(e.id, d));
        const shift = bestShift(e, d);
        if (!shift) return false;
        setCell(e.id, d, work(shift));
      }
    }
    return true;
  }

  const partners = (e: Employee) =>
    base.relations
      .filter(
        (r) =>
          r.type === "same_days_off" &&
          (r.employeeAId === e.id || r.employeeBId === e.id),
      )
      .map((r) => (r.employeeAId === e.id ? r.employeeBId : r.employeeAId))
      .map((id) => employees.find((x) => x.id === id))
      .filter((x): x is Employee => Boolean(x));

  for (const e of employees.filter((e) => e.requiresMonthlyWeekendOff)) {
    if (hasWeekendOff(e)) continue;
    const group = [e, ...partners(e)];
    done: for (const weekend of weekends) {
      for (const giveBack of ["both", "first", "second", "none"] as const) {
        const ids = group.map((g) => g.id);
        if (
          tryChanges(
            ids,
            () => freeWeekend(group, weekend, giveBack),
            fewerErrors,
          )
        )
          break done;
      }
    }
  }

  for (const e of employees.filter((e) => e.monthlyTlDays > 0)) {
    let placed = dates.filter(
      (d) => cellOf(e.id, d)?.dayCode === TIME_OFF_IN_LIEU,
    ).length;
    // Mid-month first, so the day is not squeezed against leave at the edges.
    const order = [...dates.slice(9), ...dates.slice(0, 9)];
    for (const d of order) {
      if (placed >= e.monthlyTlDays) break;
      if (!cellOf(e.id, d)?.shiftTypeId || locked.has(key(e.id, d))) continue;
      const ok = tryChanges(
        [e.id],
        () => {
          setCell(e.id, d, code(TIME_OFF_IN_LIEU));
          return true;
        },
        (before, after) =>
          noNewError(before, after) &&
          warningCount(after) < warningCount(before),
      );
      if (ok) placed++;
    }
  }

  const clean = validateSchedule(input());

  // ---------------------------------------------------------------- 4. deliberate mistakes

  const byName = (name: string) => {
    const e = employees.find((x) => x.displayName === name);
    if (!e) throw new Error(`Unknown employee ${name}`);
    return e;
  };
  const shiftId = (employee: Employee, shiftCode: string) => {
    const s = base.shiftTypes.find(
      (t) => t.sectionId === employee.primarySectionId && t.code === shiftCode,
    );
    if (!s) throw new Error(`Unknown shift ${shiftCode}`);
    return s.id;
  };
  const mistakes: string[] = [];
  const firstDate = (pred: (d: IsoDate) => boolean) => {
    const d = dates.find(pred);
    if (!d) throw new Error("No date matches a deliberate mistake");
    return d;
  };
  // Each mistake is best effort: a month without a matching day simply skips it.
  const attempt = (fn: () => void) => {
    if (!withMistakes) return;
    try {
      fn();
    } catch {
      // skipped
    }
  };

  attempt(() => {
    // Birthday worked instead of coded BD (any employee with a birthday this month).
    const hasBirthday = (e: Employee) =>
      dates.some((x) => cellOf(e.id, x)?.dayCode === BIRTHDAY_LEAVE);
    const e = employees.find(hasBirthday);
    if (!e) return;
    const d = firstDate((x) => cellOf(e.id, x)?.dayCode === BIRTHDAY_LEAVE);
    const shift = e.eligibility[0]?.shiftTypeId;
    if (!shift) return;
    setCell(e.id, d, work(shift));
    mistakes.push(`${e.displayName} works on their birthday (${d})`);
  });
  attempt(() => {
    // Late shift followed by an early shift.
    const e = byName("Leila Haddad");
    const d = firstDate(
      (x) =>
        x >= dates[3] &&
        Boolean(cellOf(e.id, x)?.shiftTypeId) &&
        Boolean(cellOf(e.id, addDays(x, 1))?.shiftTypeId),
    );
    setCell(e.id, d, work(shiftId(e, "B")));
    setCell(e.id, addDays(d, 1), work(shiftId(e, "A")));
    mistakes.push(`${e.displayName} works B on ${d}, then A the next morning`);
  });
  attempt(() => {
    // A rest day worked: one rest day that week and a long run of working days.
    const e = byName("Fatou Diop");
    const d = firstDate(
      (x) => x >= dates[7] && cellOf(e.id, x)?.dayCode === REST_DAY,
    );
    setCell(e.id, d, work(shiftId(e, "A")));
    mistakes.push(`${e.displayName} works a rest day (${d})`);
  });
  attempt(() => {
    // A couple no longer shares a rest day.
    const e = byName("Ingrid Solberg");
    const d = firstDate(
      (x) => x >= dates[14] && cellOf(e.id, x)?.dayCode === REST_DAY,
    );
    setCell(e.id, d, work(shiftId(e, "B")));
    mistakes.push(`${e.displayName} works while their partner rests (${d})`);
  });
  attempt(() => {
    // Restaurant short-staffed on one day.
    const section = base.sections.find((s) => s.code === "restaurant");
    const team = employees.filter((e) => e.primarySectionId === section?.id);
    const d = firstDate(
      (x) =>
        weekday(x) === 7 &&
        team.filter((e) => cellOf(e.id, x)?.shiftTypeId).length >= 2,
    );
    const working = team.filter((e) => cellOf(e.id, d)?.shiftTypeId);
    for (const e of working.slice(1)) setCell(e.id, d, code(REST_DAY));
    mistakes.push(`Restaurant & Bar has a single person on ${d}`);
  });
  attempt(() => {
    // Two colleagues who must alternate weekends are off the same weekend.
    const a = byName("Chloé Bernard");
    const b = byName("Jonas Weber");
    const weekend = weekends.find(([sat, sun]) =>
      [sat, sun].every((d) => cellOf(a.id, d)?.dayCode),
    );
    if (weekend) {
      for (const d of weekend) setCell(b.id, d, code(REST_DAY));
      mistakes.push(
        `${a.displayName} and ${b.displayName} are both off on ${weekend[0]}`,
      );
    }
  });
  attempt(() => {
    // A shift the employee is not trained for.
    const e = byName("Tomasz Nowak");
    const d = firstDate(
      (x) =>
        cellOf(e.id, addDays(x, -1))?.dayCode === REST_DAY &&
        Boolean(cellOf(e.id, x)?.shiftTypeId),
    );
    setCell(e.id, d, work(shiftId(e, "D")));
    mistakes.push(`${e.displayName} is put on the night shift (${d})`);
  });

  const sectionCode = new Map(base.sections.map((s) => [s.id, s.code]));
  const grids: Record<string, Record<string, string[]>> = {};
  for (const e of employees) {
    const section = sectionCode.get(e.primarySectionId) ?? "";
    grids[section] ??= {};
    grids[section][e.displayName] = dates.map((d) => {
      const cell = cellOf(e.id, d);
      if (cell?.shiftTypeId) return shifts.get(cell.shiftTypeId)?.code ?? "?";
      return cell?.dayCode ?? REST_DAY;
    });
  }
  return {
    year: target.year,
    month: target.month,
    grids,
    mistakes,
    cleanViolations: clean.violations,
  };
}

const monthIndex = (value: string) => {
  const [y, m] = value.split("-").map(Number);
  return y * 12 + (m - 1);
};
const monthString = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

/** Moves a date by whole months, keeping the day (clamped to the month's end). */
function shiftDate(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return toIsoDate(year, month, Math.min(d, last));
}

/**
 * Rolling demo: moves the seed's demo months so the first one is `target`, with
 * absences moved by the same number of months. The reference schedule is dropped
 * (generate it again for the new month).
 */
export function shiftSeedFile(
  seed: SeedFile,
  target: { year: number; month: number },
): SeedFile {
  const offset =
    target.year * 12 +
    (target.month - 1) -
    monthIndex(seed._meta.demo_months[0]);
  const { reference_schedule: _dropped, ...rest } = structuredClone(seed);
  return {
    ...rest,
    _meta: {
      ...rest._meta,
      demo_months: rest._meta.demo_months.map((m) =>
        monthString(monthIndex(m) + offset),
      ),
    },
    absences: rest.absences.map((a) => ({
      ...a,
      start: shiftDate(a.start, offset),
      end: shiftDate(a.end, offset),
    })),
  };
}
