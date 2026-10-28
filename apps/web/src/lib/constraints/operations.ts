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

export type ConstraintOperation = z.infer<typeof constraintOperation>;
export type ParsedConstraint = z.infer<typeof parsedConstraintSchema>;

export const OPERATION_LABELS: Record<ConstraintOperation["type"], string> = {
  absence: "Absence",
  unavailability: "Unavailability",
  shift_ban: "Shift ban",
  shift_force: "Forced shift",
  days_off_change: "Days off change",
  staffing_override: "Staffing override",
  unparseable: "Not understood",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface OperationNames {
  employee: (id: string) => string;
  shift: (id: string) => string;
  section: (id: string) => string;
}

function range(start: string, end: string) {
  return start === end ? `on ${start}` : `from ${start} to ${end}`;
}

/** Human-readable sentence for the review card. */
export function describeOperation(
  op: ConstraintOperation,
  names: OperationNames,
): string {
  switch (op.type) {
    case "absence":
      return `${names.employee(op.employeeId)}: ${op.dayCode} ${range(op.startDate, op.endDate)}.`;
    case "unavailability":
      return `${names.employee(op.employeeId)} unavailable ${
        op.startTime && op.endTime ? `${op.startTime}–${op.endTime}` : "all day"
      } ${range(op.startDate, op.endDate)}.`;
    case "shift_ban":
      return `${names.employee(op.employeeId)} must not work ${names.shift(op.shiftTypeId)} ${range(op.startDate, op.endDate)}.`;
    case "shift_force":
      return `${names.employee(op.employeeId)} works ${names.shift(op.shiftTypeId)} on ${op.date}.`;
    case "days_off_change":
      return `${names.employee(op.employeeId)}: fixed days off become ${
        op.firstWeekday ? WEEKDAYS[op.firstWeekday - 1] : "—"
      } and ${op.secondWeekday ? WEEKDAYS[op.secondWeekday - 1] : "—"}.`;
    case "staffing_override":
      return `${names.section(op.sectionId)} ${
        op.shiftTypeId ? names.shift(op.shiftTypeId) : "(any shift)"
      }: min ${op.minStaff}${op.maxStaff !== null ? `, max ${op.maxStaff}` : ""} ${range(op.startDate, op.endDate)}.`;
    case "unparseable":
      return op.reason;
  }
}
