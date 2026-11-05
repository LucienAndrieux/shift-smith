import { z } from "zod";

/**
 * Typed operations extracted from a free-text constraint by the LLM (JSON-schema
 * structured outputs). Strict schemas require every field to be present, so
 * optional values are `nullable` rather than optional.
 */

const date = z.string().describe("Calendar date, YYYY-MM-DD");
const time = z.string().describe("Time of day, HH:MM (24h, 00:00–24:00)");
const id = (what: string) =>
  z.string().describe(`${what} id, copied exactly from the list`);

export const absenceOperation = z.object({
  type: z.literal("absence"),
  employeeId: id("Employee"),
  dayCode: z
    .string()
    .describe(
      "Absence day code: AL (annual leave), SL (sick leave), BD, PH, TL, TR, OL or UL",
    ),
  startDate: date,
  endDate: date.describe("Last day of the absence, inclusive, YYYY-MM-DD"),
  note: z.string().nullable(),
});

export const unavailabilityOperation = z.object({
  type: z.literal("unavailability"),
  employeeId: id("Employee"),
  startDate: date,
  endDate: date.describe("Last day, inclusive, YYYY-MM-DD"),
  startTime: time
    .nullable()
    .describe("Start of the unavailable window, null = whole day"),
  endTime: time
    .nullable()
    .describe("End of the unavailable window, null = whole day"),
  reason: z.string().nullable(),
});

export const shiftBanOperation = z.object({
  type: z.literal("shift_ban"),
  employeeId: id("Employee"),
  shiftTypeId: id("Shift type"),
  startDate: date,
  endDate: date.describe("Last day, inclusive, YYYY-MM-DD"),
  reason: z.string().nullable(),
});

export const shiftForceOperation = z.object({
  type: z.literal("shift_force"),
  employeeId: id("Employee"),
  shiftTypeId: id("Shift type"),
  date,
  reason: z.string().nullable(),
});

export const daysOffChangeOperation = z.object({
  type: z.literal("days_off_change"),
  employeeId: id("Employee"),
  firstWeekday: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .describe("New first weekly rest day, 1 = Monday … 7 = Sunday"),
  secondWeekday: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .describe("New second weekly rest day, 1 = Monday … 7 = Sunday"),
  reason: z.string().nullable(),
});

export const staffingOverrideOperation = z.object({
  type: z.literal("staffing_override"),
  sectionId: id("Section"),
  shiftTypeId: id("Shift type")
    .nullable()
    .describe("null = any shift of the section"),
  startDate: date,
  endDate: date.describe("Last day, inclusive, YYYY-MM-DD"),
  minStaff: z.number().int().min(0).max(50),
  maxStaff: z.number().int().min(0).max(50).nullable(),
  reason: z.string().nullable(),
});

export const unparseableOperation = z.object({
  type: z.literal("unparseable"),
  reason: z
    .string()
    .describe(
      "Why this part of the text could not be turned into an operation",
    ),
});

export const constraintOperation = z.discriminatedUnion("type", [
  absenceOperation,
  unavailabilityOperation,
  shiftBanOperation,
  shiftForceOperation,
  daysOffChangeOperation,
  staffingOverrideOperation,
  unparseableOperation,
]);

export const parsedConstraintSchema = z.object({
  summary: z
    .string()
    .describe("One sentence restating the constraint in plain English"),
  operations: z.array(constraintOperation),
});

/**
 * What the model answers: the stored result plus whether the text gives any
 * date at all (a note without one is refused, see server/constraints/parse.ts).
 */
export const constraintResponseSchema = parsedConstraintSchema.extend({
  hasDate: z
    .boolean()
    .describe(
      'Whether the text gives at least one date or period: a day ("the 16th", "16/11", "next Monday", "tomorrow"), a range, a week or a month',
    ),
});

export type ConstraintOperation = z.infer<typeof constraintOperation>;
export type ParsedConstraint = z.infer<typeof parsedConstraintSchema>;

export type OperationType = ConstraintOperation["type"];

export interface OperationNames {
  employee: (id: string) => string;
  shift: (id: string) => string;
  section: (id: string) => string;
}

/** Sentences of the interface language (`t.operations`). */
export interface OperationText {
  on: (date: string) => string;
  fromTo: (start: string, end: string) => string;
  allDay: string;
  anyShift: string;
  absence: (name: string, code: string, range: string) => string;
  unavailable: (name: string, window: string, range: string) => string;
  shiftBan: (name: string, shift: string, range: string) => string;
  shiftForce: (name: string, shift: string, date: string) => string;
  daysOff: (name: string, first: string, second: string) => string;
  staffing: (
    section: string,
    shift: string,
    min: number,
    max: number | null,
    range: string,
  ) => string;
}

/** Human-readable sentence for the review card. */
export function describeOperation(
  op: ConstraintOperation,
  names: OperationNames,
  text: OperationText,
  /** Short weekday names, Monday first. */
  weekdays: readonly string[],
): string {
  const range = (start: string, end: string) =>
    start === end ? text.on(start) : text.fromTo(start, end);
  switch (op.type) {
    case "absence":
      return text.absence(
        names.employee(op.employeeId),
        op.dayCode,
        range(op.startDate, op.endDate),
      );
    case "unavailability":
      return text.unavailable(
        names.employee(op.employeeId),
        op.startTime && op.endTime
          ? `${op.startTime}–${op.endTime}`
          : text.allDay,
        range(op.startDate, op.endDate),
      );
    case "shift_ban":
      return text.shiftBan(
        names.employee(op.employeeId),
        names.shift(op.shiftTypeId),
        range(op.startDate, op.endDate),
      );
    case "shift_force":
      return text.shiftForce(
        names.employee(op.employeeId),
        names.shift(op.shiftTypeId),
        op.date,
      );
    case "days_off_change":
      return text.daysOff(
        names.employee(op.employeeId),
        op.firstWeekday ? weekdays[op.firstWeekday - 1] : "—",
        op.secondWeekday ? weekdays[op.secondWeekday - 1] : "—",
      );
    case "staffing_override":
      return text.staffing(
        names.section(op.sectionId),
        op.shiftTypeId ? names.shift(op.shiftTypeId) : text.anyShift,
        op.minStaff,
        op.maxStaff,
        range(op.startDate, op.endDate),
      );
    case "unparseable":
      return op.reason;
  }
}
