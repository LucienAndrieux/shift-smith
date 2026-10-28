import {
  addDays,
  type IsoDate,
  isDateInRange,
  isoWeekKey,
  monthDates,
  weekday,
} from "./calendar";
import { BIRTHDAY_LEAVE, REST_DAY, TIME_OFF_IN_LIEU } from "./day-codes";
import { computeShiftDuration } from "./durations";
import { computeHourBank } from "./hour-bank";
import type { Assignment, Employee, ScheduleInput } from "./types";
import {
  type Violation,
  validateSchedule,
  violationIdentity,
} from "./validator";

export { violationIdentity };

/**
 * Local repair suggestions for one hard-rule violation ("Fix" button).
 *
 * Candidate edits are generated around the violation (change a cell, swap two
 * employees on a day, swap two days of one employee, move a rest day, free a
 * weekend), each one is replayed through the validator, and only the edits that
 * remove the violation without creating any new error are kept, best first.
 * The OR-Tools solver could later provide suggestions with the same
 * shape for repairs that need many changes.
 */

export interface CellValue {
  shiftTypeId: string | null;
  dayCode: string | null;
}

export interface CellChange {
  employeeId: string;
  date: IsoDate;
  before: CellValue;
  after: CellValue;
}

export interface FixSuggestion {
  changes: CellChange[];
  /** Errors removed, the target included. */
  fixedErrors: number;
  /** Warnings that appear with this fix. */
  newWarnings: number;
  /** Lower is better. */
  score: number;
}

const MAX_SUGGESTIONS = 5;

const sameValue = (a: CellValue, b: CellValue) =>
  a.shiftTypeId === b.shiftTypeId && a.dayCode === b.dayCode;

const EMPTY: CellValue = { shiftTypeId: null, dayCode: null };

export function suggestFixes(
  input: ScheduleInput,
  targetIdentity: string,
  options: { max?: number } = {},
): FixSuggestion[] {
  const base = validateSchedule(input);
  const target = base.violations.find(
    (v) => violationIdentity(v) === targetIdentity,
  );
  if (!target) return [];

  const dates = monthDates(input.year, input.month);
  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];
  const active = input.employees.filter((e) => e.status === "active");
  const employeeById = new Map(active.map((e) => [e.id, e]));
  const shiftById = new Map(input.shiftTypes.map((s) => [s.id, s]));
  const paid = new Map(
    input.shiftTypes.map((s) => {
      try {
        return [s.id, computeShiftDuration(s.periods).paidMinutes];
      } catch {
        return [s.id, 0];
      }
    }),
  );
  const dayCodes = new Map(input.dayCodes.map((d) => [d.code, d]));

  // Current month cells.
  const cells = new Map<string, Assignment>();
  const key = (employeeId: string, date: string) => `${employeeId}|${date}`;
  for (const a of input.assignments) cells.set(key(a.employeeId, a.date), a);
  const cellValue = (employeeId: string, date: string): CellValue => {
    const a = cells.get(key(employeeId, date));
    return a ? { shiftTypeId: a.shiftTypeId, dayCode: a.dayCode } : EMPTY;
  };

  const absenceOn = (employeeId: string, date: string) =>
    input.absences.find(
      (a) =>
        a.employeeId === employeeId && date >= a.startDate && date <= a.endDate,
    );
  /** Locked cells and approved absences are never moved (except to restore the absence). */
  const canChange = (employee: Employee, date: string) =>
    date >= monthStart &&
    date <= monthEnd &&
    isDateInRange(date, employee.hiredOn, employee.leftOn) &&
    !cells.get(key(employee.id, date))?.isLocked &&
    (target.code === "approved_leave_is_fixed" ||
      !absenceOn(employee.id, date));

  const eligibleShifts = (employee: Employee) =>
    employee.eligibility
      .map((el) => shiftById.get(el.shiftTypeId))
      .filter((s) => s?.isActive)
      .map((s) => ({ shiftTypeId: s?.id ?? null, dayCode: null }) as CellValue);
  const canHold = (employee: Employee, value: CellValue) =>
    !value.shiftTypeId ||
    employee.eligibility.some((el) => el.shiftTypeId === value.shiftTypeId);
  const isRest = (value: CellValue) =>
    Boolean(value.dayCode && dayCodes.get(value.dayCode)?.kind === "rest");
  const isWork = (value: CellValue) => Boolean(value.shiftTypeId);

  // ---------------------------------------------------------------- scope

  const relationPartners = (employeeId: string) =>
    input.relations
      .filter(
        (r) => r.employeeAId === employeeId || r.employeeBId === employeeId,
      )
      .map((r) =>
        r.employeeAId === employeeId ? r.employeeBId : r.employeeAId,
      );

  const focusEmployees: Employee[] = target.employeeId
    ? [
        target.employeeId,
        ...(target.code === "same_days_off" ||
        target.code === "different_weekend_off"
          ? relationPartners(target.employeeId)
          : []),
      ]
        .map((id) => employeeById.get(id))
        .filter((e): e is Employee => Boolean(e))
    : active.filter(
        (e) =>
          e.primarySectionId === target.sectionId ||
          e.eligibility.some(
            (el) =>
              shiftById.get(el.shiftTypeId)?.sectionId === target.sectionId,
          ),
      );

  const inMonth = (d: string) => d >= monthStart && d <= monthEnd;
  const weekOf = (d: string) =>
    dates.filter((x) => isoWeekKey(x) === isoWeekKey(d));
  let focusDates: string[];
  if (target.weekKey) {
    focusDates = dates.filter((d) => isoWeekKey(d) === target.weekKey);
  } else if (target.date) {
    focusDates =
      target.code === "min_rest_between_shifts_hours"
        ? [addDays(target.date, -1), target.date].filter(inMonth)
        : target.code === "max_consecutive_work_days"
          ? Array.from({ length: 7 }, (_, i) =>
              addDays(target.date as string, -i),
            ).filter(inMonth)
          : [target.date];
  } else {
    focusDates = dates;
  }

  // ---------------------------------------------------------------- candidates

  const candidates = new Map<string, CellChange[]>();
  const addCandidate = (changes: CellChange[]) => {
    const effective = changes.filter((c) => !sameValue(c.before, c.after));
    if (effective.length === 0) return;
    const signature = effective
      .map(
        (c) =>
          `${c.employeeId}@${c.date}=${c.after.shiftTypeId ?? c.after.dayCode}`,
      )
      .sort()
      .join(";");
    if (!candidates.has(signature)) candidates.set(signature, effective);
  };
  const change = (
    employee: Employee,
    date: string,
    after: CellValue,
  ): CellChange => ({
    employeeId: employee.id,
    date,
    before: cellValue(employee.id, date),
    after,
  });

  const valueOptions = (employee: Employee): CellValue[] => {
    const values = [
      ...eligibleShifts(employee),
      { shiftTypeId: null, dayCode: REST_DAY },
    ];
    if (target.code === "birthday_off")
      values.push({ shiftTypeId: null, dayCode: BIRTHDAY_LEAVE });
    if (target.code === "monthly_tl_days")
      values.push({ shiftTypeId: null, dayCode: TIME_OFF_IN_LIEU });
    if (target.code === "approved_leave_is_fixed" && target.date) {
      const absence = absenceOn(employee.id, target.date);
      if (absence) values.push({ shiftTypeId: null, dayCode: absence.dayCode });
    }
    return values;
  };

  for (const employee of focusEmployees) {
    for (const date of focusDates) {
      if (!canChange(employee, date)) continue;
      const current = cellValue(employee.id, date);

      // 1. Change one cell.
      for (const value of valueOptions(employee)) {
        if (!sameValue(value, current))
          addCandidate([change(employee, date, value)]);
      }

      // 2. Swap with a colleague on the same day.
      for (const other of active) {
        if (
          other.id === employee.id ||
          other.primarySectionId !== employee.primarySectionId
        )
          continue;
        if (!canChange(other, date)) continue;
        const theirs = cellValue(other.id, date);
        if (
          sameValue(theirs, current) ||
          !canHold(employee, theirs) ||
          !canHold(other, current)
        )
          continue;
        addCandidate([
          change(employee, date, theirs),
          change(other, date, current),
        ]);
      }

      // 3. Swap two days of the same week.
      for (const other of weekOf(date)) {
        if (other === date || !canChange(employee, other)) continue;
        const value = cellValue(employee.id, other);
        if (sameValue(value, current)) continue;
        addCandidate([
          change(employee, date, value),
          change(employee, other, current),
        ]);
      }

      // 4. Work on a rest day, move that rest day to a worked day of the week
      //    (staffing shortages, birthdays falling on a rest day).
      if (isRest(current)) {
        const putHere: CellValue[] =
          target.code === "birthday_off"
            ? [{ shiftTypeId: null, dayCode: BIRTHDAY_LEAVE }]
            : eligibleShifts(employee).filter(
                (v) =>
                  !target.sectionId ||
                  shiftById.get(v.shiftTypeId ?? "")?.sectionId ===
                    target.sectionId,
              );
        for (const other of weekOf(date)) {
          if (
            other === date ||
            !canChange(employee, other) ||
            !isWork(cellValue(employee.id, other))
          )
            continue;
          for (const value of putHere) {
            addCandidate([
              change(employee, date, value),
              change(employee, other, current),
            ]);
          }
        }
      }
    }
  }

  // 5. Free a full weekend: swap Saturday and Sunday with rest days of the same weeks.
  if (
    target.code === "weekend_off_per_month" ||
    target.code === "different_weekend_off"
  ) {
    for (const employee of focusEmployees) {
      for (const sat of dates.filter(
        (d) => weekday(d) === 6 && inMonth(addDays(d, 1)),
      )) {
        const sun = addDays(sat, 1);
        const plan: CellChange[] = [];
        let ok = true;
        for (const day of [sat, sun]) {
          const value = cellValue(employee.id, day);
          if (!isWork(value)) continue;
          const restDay = weekOf(day).find(
            (d) =>
              d !== sat &&
              d !== sun &&
              isRest(cellValue(employee.id, d)) &&
              canChange(employee, d) &&
              !plan.some((c) => c.date === d),
          );
          if (!restDay || !canChange(employee, day)) {
            ok = false;
            break;
          }
          plan.push(change(employee, day, cellValue(employee.id, restDay)));
          plan.push(change(employee, restDay, value));
        }
        if (ok && plan.length > 0) addCandidate(plan);
      }
    }
  }

  // ---------------------------------------------------------------- evaluation

  const identities = (violations: Violation[], severity: "error" | "warning") =>
    new Set(
      violations.filter((v) => v.severity === severity).map(violationIdentity),
    );
  const errorsBefore = identities(base.violations, "error");
  const warningsBefore = identities(base.violations, "warning");
  const deltaBefore = new Map(
    base.employeeTotals.map((t) => [t.employeeId, t.month.deltaMinutes]),
  );

  const suggestions: FixSuggestion[] = [];
  for (const changes of candidates.values()) {
    const changed = new Map(changes.map((c) => [key(c.employeeId, c.date), c]));
    const assignments: Assignment[] = [];
    for (const a of input.assignments) {
      const c = changed.get(key(a.employeeId, a.date));
      if (!c) assignments.push(a);
      else if (c.after.shiftTypeId || c.after.dayCode)
        assignments.push({ ...a, ...c.after });
      changed.delete(key(a.employeeId, a.date));
    }
    for (const c of changed.values()) {
      if (c.after.shiftTypeId || c.after.dayCode) {
        assignments.push({
          employeeId: c.employeeId,
          date: c.date,
          ...c.after,
          isLocked: false,
        });
      }
    }

    const result = validateSchedule({ ...input, assignments });
    const errorsAfter = identities(result.violations, "error");
    if (result.violations.some((v) => violationIdentity(v) === targetIdentity))
      continue;
    if ([...errorsAfter].some((id) => !errorsBefore.has(id))) continue;

    const fixedErrors = [...errorsBefore].filter(
      (id) => !errorsAfter.has(id),
    ).length;
    const newWarnings = [...identities(result.violations, "warning")].filter(
      (id) => !warningsBefore.has(id),
    ).length;
    // Errors fixed besides the target itself.
    const extraFixed =
      target.severity === "error" ? fixedErrors - 1 : fixedErrors;
    // Prefer fixes that keep each employee's hour balance where it was.
    let hourDrift = 0;
    for (const employeeId of new Set(changes.map((c) => c.employeeId))) {
      const employee = employeeById.get(employeeId);
      if (!employee) continue;
      const after = computeHourBank({
        employee,
        dates,
        assignments: assignments.filter((a) => a.employeeId === employeeId),
        shiftPaidMinutes: paid,
        dayCodes,
      }).deltaMinutes;
      hourDrift += Math.abs(after - (deltaBefore.get(employeeId) ?? 0));
    }
    suggestions.push({
      changes,
      fixedErrors,
      newWarnings,
      score:
        changes.length * 2 + newWarnings * 3 - extraFixed * 5 + hourDrift / 120,
    });
  }

  return suggestions
    .sort((a, b) => a.score - b.score)
    .slice(0, options.max ?? MAX_SUGGESTIONS);
}
