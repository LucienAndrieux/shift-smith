import { z } from "zod";
import { parseTimeOfDay } from "@/lib/domain/time";

/**
 * Form-friendly field schemas. Inputs are strings (what HTML inputs produce); outputs
 * are the typed values stored in the database. The same schema validates on the
 * client (React Hook Form) and again in the Server Action.
 */

/** Optional free text: "" → null. */
export const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const requiredText = (max = 200, message = "Required") =>
  z.string().trim().min(1, message).max(max);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z.string().regex(DATE_RE, "Enter a date");

/** Optional date: "" → null. */
export const optionalDate = z
  .string()
  .refine((v) => v === "" || DATE_RE.test(v), "Enter a date")
  .transform((v) => (v === "" ? null : v));

/** Integer typed in a text/number input. */
export const intString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Enter a whole number")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

/** Optional integer: "" → null. */
export const optionalIntString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^-?\d+$/.test(v), "Enter a whole number")
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable());

/** Decimal number typed in a text input (comma or dot). */
export const decimalString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "Enter a number")
    .transform(Number)
    .pipe(z.number().min(min).max(max));

/** "HH:MM" (00:00–24:00) → minutes from midnight. */
export const timeOfDay = z
  .string()
  .trim()
  .refine((v) => {
    try {
      parseTimeOfDay(v);
      return true;
    } catch {
      return false;
    }
  }, "Use HH:MM (00:00–24:00)")
  .transform(parseTimeOfDay);

/** Optional "HH:MM": "" → null. */
export const optionalTimeOfDay = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    try {
      parseTimeOfDay(v);
      return true;
    } catch {
      return false;
    }
  }, "Use HH:MM (00:00–24:00)")
  .transform((v) => (v === "" ? null : parseTimeOfDay(v)));

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #3b82f6");

export const uuid = z.uuid();

/** "" → null for optional foreign keys chosen in a select. */
export const optionalUuid = z
  .string()
  .refine((v) => v === "" || z.uuid().safeParse(v).success, "Invalid value")
  .transform((v) => (v === "" ? null : v));
