import { z } from "zod";
import { isoDate, optionalText, uuid } from "./common";

/** Encoded cell value: "s:<shiftTypeId>", "d:<dayCode>" or "" (clear the cell). */
export const cellValue = z
  .string()
  .regex(/^(|s:[0-9a-f-]{36}|d:[A-Z]{1,4})$/i, "Invalid value");

export const setCellSchema = z.object({
  scheduleId: uuid,
  employeeId: uuid,
  date: isoDate,
  value: cellValue,
  isLocked: z.boolean(),
  note: optionalText(500),
});

export const scheduleIdSchema = z.object({ scheduleId: uuid });

export const newDraftSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  /** Prefill fixed days off (OF), approved absences and birthdays. */
  prefill: z.boolean(),
});

export function decodeCellValue(value: string): {
  shiftTypeId: string | null;
  dayCode: string | null;
} {
  if (value.startsWith("s:"))
    return { shiftTypeId: value.slice(2), dayCode: null };
  if (value.startsWith("d:"))
    return { shiftTypeId: null, dayCode: value.slice(2) };
  return { shiftTypeId: null, dayCode: null };
}

export function encodeCellValue(cell: {
  shiftTypeId: string | null;
  dayCode: string | null;
}): string {
  if (cell.shiftTypeId) return `s:${cell.shiftTypeId}`;
  if (cell.dayCode) return `d:${cell.dayCode}`;
  return "";
}

const cellValueSchema = z.object({
  shiftTypeId: uuid.nullable(),
  dayCode: z.string().max(4).nullable(),
});

export const suggestFixesSchema = z.object({
  scheduleId: uuid,
  /** `violationIdentity()` of the error to fix. */
  violation: z.string().min(1).max(500),
});

export const applyFixSchema = z.object({
  scheduleId: uuid,
  changes: z
    .array(
      z.object({
        employeeId: uuid,
        date: isoDate,
        before: cellValueSchema,
        after: cellValueSchema,
      }),
    )
    .min(1)
    .max(10),
});

export const generateScheduleSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  timeLimitSeconds: z.number().int().min(10).max(300),
});

export const solverRunIdSchema = z.object({ runId: uuid });
