import {
  daysInMonth,
  isDateInRange,
  monthDates,
  toIsoDate,
  weekday,
} from "./calendar";
import { ANNUAL_LEAVE, BIRTHDAY_LEAVE, REST_DAY } from "./day-codes";
import type { Assignment, MonthContext } from "./types";

/**
 * Cells that are known before any planning: approved absences, the birthday (BD)
 * and the fixed rest days (OF). Precedence: absence > fixed rest day > birthday,
 * so a birthday falling on a rest day keeps the rest day (the validator reports it).
 * Prefilled absence cells are locked: the solver must keep them.
 */
export function prefillAssignments(context: MonthContext): Assignment[] {
  const dates = monthDates(context.year, context.month);
  const result: Assignment[] = [];

  for (const employee of context.employees) {
    if (employee.status !== "active") continue;
    const absences = context.absences.filter(
      (a) => a.employeeId === employee.id,
    );
    const rest = new Set(employee.fixedDaysOff.map((f) => f.weekday));
    const birthday =
      employee.birthdayMonth === context.month && employee.birthdayDay
        ? toIsoDate(
            context.year,
            context.month,
            Math.min(
              employee.birthdayDay,
              daysInMonth(context.year, context.month),
            ),
          )
        : null;

    for (const date of dates) {
      if (!isDateInRange(date, employee.hiredOn, employee.leftOn)) continue;
      const absence = absences.find(
        (a) => date >= a.startDate && date <= a.endDate,
      );
      const isRestDay = rest.has(weekday(date));
      let dayCode: string | null = null;
      let isLocked = false;
      if (absence) {
        // Leave ranges are calendar ranges: rest days inside them stay OF.
        dayCode =
          isRestDay && absence.dayCode === ANNUAL_LEAVE
            ? REST_DAY
            : absence.dayCode;
        isLocked = dayCode === absence.dayCode;
      } else if (isRestDay) {
        dayCode = REST_DAY;
      } else if (date === birthday) {
        dayCode = BIRTHDAY_LEAVE;
        isLocked = true;
      }
      if (dayCode) {
        result.push({
          employeeId: employee.id,
          date,
          shiftTypeId: null,
          dayCode,
          isLocked,
        });
      }
    }
  }
  return result;
}
