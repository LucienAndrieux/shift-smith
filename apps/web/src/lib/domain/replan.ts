import { addDays, type IsoDate, isDateInRange, yearMonthOf } from "./calendar";
import type { Absence, Assignment } from "./types";

/**
 * "Replan from tomorrow": the solver keeps every cell before tomorrow and
 * reworks the rest of the month, changing as few cells as it can.
 */

/** First replanned day (tomorrow) when it falls in the month, otherwise null. */
export function replanStart(
  year: number,
  month: number,
  today: IsoDate,
): IsoDate | null {
  const tomorrow = addDays(today, 1);
  const ym = yearMonthOf(tomorrow);
  return ym.year === year && ym.month === month ? tomorrow : null;
}

/**
 * Locked cells from `from` on that the solver must keep. A lock on a day now
 * covered by an approved absence is dropped: the absence is why we replan.
 */
export function replanLocks(
  assignments: readonly Assignment[],
  absences: readonly Absence[],
  from: IsoDate,
): Assignment[] {
  return assignments.filter(
    (a) =>
      a.isLocked &&
      a.date >= from &&
      !absences.some(
        (x) =>
          x.employeeId === a.employeeId &&
          isDateInRange(a.date, x.startDate, x.endDate),
      ),
  );
}
