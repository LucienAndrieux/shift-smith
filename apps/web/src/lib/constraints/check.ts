import { parseTimeOfDay } from "@/lib/domain/time";
import type { ConstraintOperation, ParsedConstraint } from "./operations";

export interface ConstraintReferences {
  employeeIds: ReadonlySet<string>;
  shiftTypeIds: ReadonlySet<string>;
  sectionIds: ReadonlySet<string>;
  absenceCodes: ReadonlySet<string>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function validTime(value: string): boolean {
  try {
    parseTimeOfDay(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Months (YYYY-MM) of the operations' dates that differ from the target month: the
 * text named another month than the one picked in the form.
 */
export function monthsOutsideTarget(
  parsed: ParsedConstraint,
  target: string,
): string[] {
  const months = new Set(
    parsed.operations.flatMap((op) =>
      operationDates(op)
        .filter((d) => DATE_RE.test(d))
        .map((d) => d.slice(0, 7)),
    ),
  );
  months.delete(target);
  return [...months].sort();
}

/**
 * Problems that structured outputs cannot rule out: ids that are not in the lists
 * given to the model, impossible dates, reversed ranges, wrong codes.
 * Returns one message per problem (empty = the result can be shown for approval).
 */
export function checkParsedConstraint(
  parsed: ParsedConstraint,
  refs: ConstraintReferences,
): string[] {
  const problems: string[] = [];
  parsed.operations.forEach((op, i) => {
    const at = `Operation ${i + 1} (${op.type})`;
    const add = (message: string) => problems.push(`${at}: ${message}`);
    if ("employeeId" in op && !refs.employeeIds.has(op.employeeId))
      add("unknown employee");
    if (
      "shiftTypeId" in op &&
      op.shiftTypeId !== null &&
      !refs.shiftTypeIds.has(op.shiftTypeId)
    ) {
      add("unknown shift");
    }
    if (op.type === "staffing_override" && !refs.sectionIds.has(op.sectionId)) {
      add("unknown section");
    }
    for (const value of operationDates(op)) {
      if (!validDate(value)) add(`invalid date "${value}"`);
    }
    if ("startDate" in op && "endDate" in op && op.endDate < op.startDate) {
      add("the end date is before the start date");
    }
    if (op.type === "absence" && !refs.absenceCodes.has(op.dayCode)) {
      add(`"${op.dayCode}" is not an absence code`);
    }
    if (op.type === "unavailability") {
      if ((op.startTime === null) !== (op.endTime === null)) {
        add("give both times or neither");
      } else if (op.startTime && op.endTime) {
        if (!validTime(op.startTime) || !validTime(op.endTime))
          add("invalid time");
        else if (parseTimeOfDay(op.endTime) <= parseTimeOfDay(op.startTime)) {
          add("the end time is before the start time");
        }
      }
    }
    if (
      op.type === "days_off_change" &&
      op.firstWeekday !== null &&
      op.firstWeekday === op.secondWeekday
    ) {
      add("the two rest days must be different");
    }
    if (
      op.type === "staffing_override" &&
      op.maxStaff !== null &&
      op.maxStaff < op.minStaff
    ) {
      add("maximum below minimum");
    }
  });
  return problems;
}

/** Dates written in an operation (range bounds or single date). */
export function operationDates(op: ConstraintOperation): string[] {
  switch (op.type) {
    case "shift_force":
      return [op.date];
    case "absence":
    case "unavailability":
    case "shift_ban":
    case "staffing_override":
      return [op.startDate, op.endDate];
    default:
      return [];
  }
}
