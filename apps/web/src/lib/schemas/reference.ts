import { z } from "zod";
import { RULE_CODES } from "@/lib/domain/rules";
import {
  decimalString,
  hexColor,
  intString,
  isoDate,
  optionalDate,
  optionalIntString,
  optionalText,
  optionalTimeOfDay,
  optionalUuid,
  requiredText,
  timeOfDay,
  uuid,
} from "./common";

// ---------------------------------------------------------------- employees

export const employeeSchema = z
  .object({
    displayName: requiredText(100, "Enter a name"),
    fullName: optionalText(200),
    employeeNumber: optionalText(20),
    primarySectionId: uuid,
    status: z.enum(["active", "inactive"]),
    weeklyContractHours: decimalString(1, 60),
    reducedSchedule: z.boolean(),
    monthlyTlDays: intString(0, 31),
    requiresMonthlyWeekendOff: z.boolean(),
    birthdayMonth: optionalIntString(1, 12),
    birthdayDay: optionalIntString(1, 31),
    hiredOn: optionalDate,
    leftOn: optionalDate,
    notes: optionalText(2000),
    toConfirm: z.boolean(),
  })
  .refine((v) => (v.birthdayMonth === null) === (v.birthdayDay === null), {
    path: ["birthdayDay"],
    message: "Enter both month and day, or neither",
  })
  .refine((v) => !v.hiredOn || !v.leftOn || v.leftOn >= v.hiredOn, {
    path: ["leftOn"],
    message: "Must be after the hiring date",
  });

export type EmployeeFormValues = z.input<typeof employeeSchema>;

export const fixedDaysOffSchema = z
  .object({
    employeeId: uuid,
    /** Weekdays of the two weekly rest days; "" = none. */
    first: optionalIntString(1, 7),
    second: optionalIntString(1, 7),
  })
  .refine(
    (v) => v.first === null || v.second === null || v.first !== v.second,
    { path: ["second"], message: "The two rest days must be different" },
  );

export const eligibilitySchema = z
  .object({
    employeeId: uuid,
    shiftTypeId: uuid,
    preference: z.enum(["preferred", "normal", "rare"]),
    maxPerWeek: optionalIntString(0, 7),
    exactPerWeek: optionalIntString(0, 7),
    note: optionalText(500),
  })
  .refine((v) => v.maxPerWeek === null || v.exactPerWeek === null, {
    path: ["exactPerWeek"],
    message: "Use either a maximum or an exact count",
  });

export const relationSchema = z
  .object({
    employeeAId: uuid,
    employeeBId: uuid,
    type: z.enum(["same_days_off", "different_weekend_off"]),
    note: optionalText(500),
  })
  .refine((v) => v.employeeAId !== v.employeeBId, {
    path: ["employeeBId"],
    message: "Choose two different employees",
  });

export const unavailabilitySchema = z
  .object({
    employeeId: uuid,
    date: isoDate,
    startTime: optionalTimeOfDay,
    endTime: optionalTimeOfDay,
    reason: optionalText(500),
  })
  .refine((v) => (v.startTime === null) === (v.endTime === null), {
    path: ["endTime"],
    message: "Enter both times, or neither for the whole day",
  })
  .refine(
    (v) =>
      v.startTime === null || v.endTime === null || v.endTime > v.startTime,
    { path: ["endTime"], message: "End must be after start" },
  );

export const hourBankAdjustmentSchema = z.object({
  employeeId: uuid,
  entryDate: isoDate,
  /** Signed hours, e.g. "-7.6" or "2.5". */
  hours: decimalString(-500, 500),
  note: requiredText(500, "Explain the adjustment"),
});

// ---------------------------------------------------------------- absences

export const absenceSchema = z
  .object({
    employeeId: uuid,
    dayCode: z.string().min(1, "Choose a code"),
    startDate: isoDate,
    endDate: isoDate,
    status: z.enum(["approved", "cancelled"]),
    endToConfirm: z.boolean(),
    note: optionalText(500),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End must be on or after start",
  });

// ---------------------------------------------------------------- sections & shifts

export const sectionSchema = z.object({
  name: requiredText(100),
  coverageNote: optionalText(1000),
  sortOrder: intString(0, 999),
});

export const periodSchema = z.object({
  start: timeOfDay,
  end: timeOfDay,
  unpaidBreakMinutes: intString(0, 600),
});

export const shiftTypeSchema = z.object({
  sectionId: uuid,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]$/, "One letter, A–Z"),
  label: requiredText(100),
  color: hexColor,
  isActive: z.boolean(),
  toConfirm: z.boolean(),
  notes: optionalText(1000),
  periods: z.array(periodSchema).min(1, "Add at least one period").max(6),
});

export type ShiftTypeFormValues = z.input<typeof shiftTypeSchema>;

// ---------------------------------------------------------------- staffing

export const staffingRequirementSchema = z
  .object({
    sectionId: uuid,
    shiftTypeId: optionalUuid,
    weekday: optionalIntString(1, 7),
    minStaff: intString(0, 50),
    maxStaff: optionalIntString(0, 50),
    validFrom: optionalDate,
    validTo: optionalDate,
    toConfirm: z.boolean(),
    note: optionalText(500),
  })
  .refine((v) => v.maxStaff === null || v.maxStaff >= v.minStaff, {
    path: ["maxStaff"],
    message: "Must be at least the minimum",
  })
  .refine((v) => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, {
    path: ["validTo"],
    message: "Must be after the start",
  });

export const staffingOverrideSchema = z
  .object({
    sectionId: uuid,
    shiftTypeId: optionalUuid,
    date: isoDate,
    minStaff: intString(0, 50),
    maxStaff: optionalIntString(0, 50),
    reason: optionalText(500),
  })
  .refine((v) => v.maxStaff === null || v.maxStaff >= v.minStaff, {
    path: ["maxStaff"],
    message: "Must be at least the minimum",
  });

// ---------------------------------------------------------------- holidays

export const holidaySchema = z.object({
  date: isoDate,
  name: requiredText(200),
  type: z.enum(["public", "regional", "company"]),
});

// ---------------------------------------------------------------- rules

export const ruleSchema = z
  .object({
    code: z.enum(RULE_CODES),
    scope: z.enum(["global", "section", "employee"]),
    sectionId: optionalUuid,
    employeeId: optionalUuid,
    /** The rule value as JSON text, e.g. {"value": 6}. */
    valueJson: z.string().trim().min(2),
    isHard: z.boolean(),
    isActive: z.boolean(),
    description: optionalText(1000),
  })
  .refine((v) => v.scope !== "section" || v.sectionId !== null, {
    path: ["sectionId"],
    message: "Choose a section",
  })
  .refine((v) => v.scope !== "employee" || v.employeeId !== null, {
    path: ["employeeId"],
    message: "Choose an employee",
  });

export const idSchema = z.object({ id: uuid });
