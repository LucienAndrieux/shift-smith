import { z } from "zod";
import { addDays, type IsoDate, toIsoDate, type Weekday } from "./calendar";
import { DEFAULT_DAY_CODES } from "./day-codes";
import type { ShiftPeriod } from "./durations";
import { HOLIDAY_COUNTRIES, publicHolidays } from "./holidays";
import { formatTimeOfDay, parseTimeOfDay } from "./time";
import type {
  DayCodeKind,
  RelationType,
  ScheduleInput,
  ShiftPreference,
} from "./types";

// ---------------------------------------------------------------------------
// Raw seed file schema (docs/seed-data.json)
// ---------------------------------------------------------------------------

const timeString = z.string().regex(/^\d{2}:\d{2}$/);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthString = z.string().regex(/^\d{4}-\d{2}$/);
const weekdayName = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const seedFileSchema = z.object({
  _meta: z
    .object({
      timezone: z.string(),
      country: z.enum(HOLIDAY_COUNTRIES),
      demo_months: z.array(monthString).min(1),
    })
    .loose(),
  day_codes: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      kind: z.enum(["rest", "absence", "other"]),
      is_due_day: z.boolean(),
      credits_time: z.boolean(),
    }),
  ),
  sections: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      coverage: z.string().optional(),
      note: z.string().optional(),
      shift_types: z.array(
        z.object({
          code: z.string(),
          periods: z.array(
            z.object({
              start: timeString,
              end: timeString,
              unpaid_break_minutes: z.number().int().nonnegative().default(0),
            }),
          ),
          note: z.string().optional(),
          to_confirm: z.boolean().optional(),
        }),
      ),
    }),
  ),
  global_rules: z.array(
    z
      .object({
        code: z.string(),
        value: z.union([z.number(), z.boolean()]),
        hard: z.boolean(),
      })
      .loose(),
  ),
  employees: z.array(
    z.object({
      name: z.string(),
      full_name: z.string().optional(),
      employee_number: z.string().optional(),
      section: z.string(),
      weekly_hours: z.number().positive(),
      reduced_schedule: z.boolean().optional(),
      role_note: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      to_confirm: z.boolean().optional(),
      fixed_days_off: z.array(weekdayName),
      monthly_tl_days: z.number().int().nonnegative(),
      requires_monthly_weekend_off: z.boolean(),
      allowed_shifts: z.array(
        z.object({
          code: z.string(),
          preferred: z.boolean().optional(),
          rare: z.boolean().optional(),
          max_per_week: z.number().int().nonnegative().optional(),
          per_week: z.number().int().nonnegative().optional(),
          note: z.string().optional(),
        }),
      ),
      birthday: z
        .string()
        .regex(/^\d{2}-\d{2}$/)
        .optional(),
      note: z.string().optional(),
    }),
  ),
  employee_relations: z.array(
    z.object({
      type: z.enum(["same_days_off", "different_weekend_off"]),
      a: z.string(),
      b: z.string(),
      reason: z.string().optional(),
    }),
  ),
  absences: z.array(
    z.object({
      employee: z.string(),
      code: z.string(),
      start: dateString,
      end: dateString,
      note: z.string().optional(),
      end_to_confirm: z.boolean().optional(),
    }),
  ),
  opening_balances: z.array(
    z.object({
      employee: z.string(),
      minutes: z.number().int(),
      note: z.string().optional(),
    }),
  ),
  staffing_requirements: z.object({
    to_confirm: z.boolean().optional(),
    note: z.string().optional(),
    rules: z.array(
      z.object({
        section: z.string(),
        shift: z.string(),
        min: z.number().int().nonnegative(),
        days: z.literal("all"),
        note: z.string().optional(),
      }),
    ),
  }),
  /** Written by scripts/generate-demo-schedule.ts. */
  reference_schedule: z
    .object({
      month: monthString,
      note: z.string().optional(),
      grids: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
    })
    .optional(),
});

export type SeedFile = z.infer<typeof seedFileSchema>;

// ---------------------------------------------------------------------------
// Normalized plan, keyed by natural keys (codes and employee names)
// ---------------------------------------------------------------------------

export interface SeedPlan {
  timezone: string;
  demoMonths: { year: number; month: number }[];
  dayCodes: {
    code: string;
    label: string;
    kind: DayCodeKind;
    isDueDay: boolean;
    creditsTime: boolean;
    color: string;
  }[];
  sections: {
    code: string;
    name: string;
    coverageNote: string | null;
    sortOrder: number;
  }[];
  shiftTypes: {
    sectionCode: string;
    code: string;
    label: string;
    color: string;
    toConfirm: boolean;
    notes: string | null;
    periods: ShiftPeriod[];
  }[];
  globalRules: {
    code: string;
    value: Record<string, unknown>;
    isHard: boolean;
    description: string | null;
  }[];
  employees: {
    name: string;
    fullName: string | null;
    employeeNumber: string | null;
    sectionCode: string;
    status: "active" | "inactive";
    weeklyContractMinutes: number;
    reducedSchedule: boolean;
    monthlyTlDays: number;
    requiresMonthlyWeekendOff: boolean;
    birthdayMonth: number | null;
    birthdayDay: number | null;
    notes: string | null;
    toConfirm: boolean;
    fixedDaysOff: { weekday: Weekday }[];
    eligibility: {
      sectionCode: string;
      shiftCode: string;
      preference: ShiftPreference;
      maxPerWeek: number | null;
      exactPerWeek: number | null;
      note: string | null;
    }[];
  }[];
  relations: {
    a: string;
    b: string;
    type: RelationType;
    note: string | null;
  }[];
  holidays: {
    date: IsoDate;
    name: string;
    type: "public" | "regional" | "company";
  }[];
  absences: {
    employee: string;
    dayCode: string;
    startDate: IsoDate;
    endDate: IsoDate;
    endToConfirm: boolean;
    note: string | null;
  }[];
  staffingRequirements: {
    sectionCode: string;
    /** null = any shift of the section. */
    shiftCode: string | null;
    weekday: Weekday | null;
    minStaff: number;
    toConfirm: boolean;
    note: string | null;
  }[];
  openingBalances: { employee: string; minutes: number; note: string }[];
  /** Empty cells until the demo schedule has been generated. */
  referenceSchedule: {
    year: number;
    month: number;
    note: string | null;
    cells: {
      employee: string;
      date: IsoDate;
      /** Shift codes refer to the grid's section. */
      sectionCode: string;
      shiftCode: string | null;
      dayCode: string | null;
    }[];
  };
}

const WEEKDAYS: Record<z.infer<typeof weekdayName>, Weekday> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

/** Consistent colours per code: shift codes share a colour across sections. */
export const SHIFT_CODE_COLORS: Record<string, string> = {
  A: "#3b82f6",
  B: "#f59e0b",
  C: "#8b5cf6",
  D: "#334155",
  E: "#14b8a6",
  F: "#ec4899",
};

export const DAY_CODE_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_DAY_CODES.map((d) => [d.code, d.color]),
);

const parseMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
};

/** Opening balances are dated the day before the first demo month. */
export function openingBalanceDate(
  plan: Pick<SeedPlan, "demoMonths">,
): IsoDate {
  const { year, month } = plan.demoMonths[0];
  return addDays(toIsoDate(year, month, 1), -1);
}

function joinNotes(...notes: (string | undefined | null)[]): string | null {
  const text = notes.filter(Boolean).join(" — ");
  return text.length > 0 ? text : null;
}

export function shiftLabel(
  code: string,
  periods: readonly ShiftPeriod[],
): string {
  const ranges = periods
    .map(
      (p) =>
        `${formatTimeOfDay(p.startMinute)}–${formatTimeOfDay(p.endMinute)}`,
    )
    .join(" / ");
  return `${code} · ${ranges}`;
}

/** Validates the raw seed file and maps it to the normalized plan. Throws on any inconsistency. */
export function buildSeedPlan(raw: unknown): SeedPlan {
  const seed = seedFileSchema.parse(raw);
  const errors: string[] = [];

  const dayCodeSet = new Set(seed.day_codes.map((d) => d.code));
  const sectionShiftCodes = new Map(
    seed.sections.map((s) => [
      s.code,
      new Set(s.shift_types.map((t) => t.code)),
    ]),
  );
  const employeeNames = new Set(seed.employees.map((e) => e.name));
  const requireEmployee = (name: string, where: string) => {
    if (!employeeNames.has(name))
      errors.push(`${where}: unknown employee "${name}"`);
  };

  const demoMonths = seed._meta.demo_months.map(parseMonth);
  const years = [...new Set(demoMonths.map((m) => m.year))];

  const plan: SeedPlan = {
    timezone: seed._meta.timezone,
    demoMonths,
    dayCodes: seed.day_codes.map((d) => ({
      code: d.code,
      label: d.label,
      kind: d.kind,
      isDueDay: d.is_due_day,
      creditsTime: d.credits_time,
      color: DAY_CODE_COLORS[d.code] ?? "#9ca3af",
    })),
    sections: seed.sections.map((s, i) => ({
      code: s.code,
      name: s.name,
      coverageNote: joinNotes(s.coverage, s.note),
      sortOrder: (i + 1) * 10,
    })),
    shiftTypes: seed.sections.flatMap((s) =>
      s.shift_types.map((t) => {
        const periods = t.periods.map((p) => ({
          startMinute: parseTimeOfDay(p.start),
          endMinute: parseTimeOfDay(p.end),
          unpaidBreakMinutes: p.unpaid_break_minutes,
        }));
        return {
          sectionCode: s.code,
          code: t.code,
          label: shiftLabel(t.code, periods),
          color: SHIFT_CODE_COLORS[t.code] ?? "#64748b",
          toConfirm: t.to_confirm ?? false,
          notes: t.note ?? null,
          periods,
        };
      }),
    ),
    globalRules: seed.global_rules.map((r) => {
      const { code, value, hard, note, applies_to, definition, ...extra } = r;
      return {
        code,
        value: { value, ...extra },
        isHard: hard,
        description: joinNotes(
          applies_to as string | undefined,
          definition as string | undefined,
          note as string | undefined,
        ),
      };
    }),
    employees: seed.employees.map((e) => {
      if (!sectionShiftCodes.has(e.section)) {
        errors.push(`Employee ${e.name}: unknown section "${e.section}"`);
      }
      if (e.fixed_days_off.length > 2) {
        errors.push(`Employee ${e.name}: more than 2 fixed days off`);
      }
      const [birthdayMonth, birthdayDay] = e.birthday
        ? e.birthday.split("-").map(Number)
        : [null, null];
      return {
        name: e.name,
        fullName: e.full_name ?? null,
        employeeNumber: e.employee_number ?? null,
        sectionCode: e.section,
        status: e.status ?? "active",
        weeklyContractMinutes: Math.round(e.weekly_hours * 60),
        reducedSchedule: e.reduced_schedule ?? false,
        monthlyTlDays: e.monthly_tl_days,
        requiresMonthlyWeekendOff: e.requires_monthly_weekend_off,
        birthdayMonth,
        birthdayDay,
        notes: joinNotes(e.role_note, e.note),
        toConfirm: e.to_confirm ?? false,
        fixedDaysOff: e.fixed_days_off.map((day) => ({
          weekday: WEEKDAYS[day],
        })),
        eligibility: e.allowed_shifts.map((s) => {
          if (!sectionShiftCodes.get(e.section)?.has(s.code)) {
            errors.push(
              `Employee ${e.name}: unknown shift ${e.section}/${s.code}`,
            );
          }
          return {
            sectionCode: e.section,
            shiftCode: s.code,
            preference: (s.preferred
              ? "preferred"
              : s.rare
                ? "rare"
                : "normal") as ShiftPreference,
            maxPerWeek: s.max_per_week ?? null,
            exactPerWeek: s.per_week ?? null,
            note: s.note ?? null,
          };
        }),
      };
    }),
    relations: seed.employee_relations.map((r) => {
      requireEmployee(r.a, "Relation");
      requireEmployee(r.b, "Relation");
      return { a: r.a, b: r.b, type: r.type, note: r.reason ?? null };
    }),
    holidays: years.flatMap((year) =>
      publicHolidays(seed._meta.country, year).map((h) => ({
        ...h,
        type: "public" as const,
      })),
    ),
    absences: seed.absences.map((a) => {
      requireEmployee(a.employee, "Absence");
      const kind = seed.day_codes.find((d) => d.code === a.code)?.kind;
      if (kind !== "absence") {
        errors.push(
          `Absence of ${a.employee}: "${a.code}" is not an absence code`,
        );
      }
      if (a.end < a.start)
        errors.push(`Absence of ${a.employee}: end before start`);
      return {
        employee: a.employee,
        dayCode: a.code,
        startDate: a.start,
        endDate: a.end,
        endToConfirm: a.end_to_confirm ?? false,
        note: a.note ?? null,
      };
    }),
    staffingRequirements: seed.staffing_requirements.rules.map((r) => {
      const shiftCode = r.shift === "ANY" ? null : r.shift;
      if (shiftCode && !sectionShiftCodes.get(r.section)?.has(shiftCode)) {
        errors.push(`Staffing: unknown shift ${r.section}/${shiftCode}`);
      }
      return {
        sectionCode: r.section,
        shiftCode,
        weekday: null,
        minStaff: r.min,
        toConfirm: seed.staffing_requirements.to_confirm ?? false,
        note: r.note ?? null,
      };
    }),
    openingBalances: seed.opening_balances.map((b) => {
      requireEmployee(b.employee, "Opening balance");
      return {
        employee: b.employee,
        minutes: b.minutes,
        note: b.note ?? "Opening balance",
      };
    }),
    referenceSchedule: buildReferenceSchedule(
      seed,
      dayCodeSet,
      sectionShiftCodes,
      errors,
    ),
  };

  for (const e of plan.employees) requireEmployee(e.name, "Employee");
  if (errors.length > 0) {
    throw new Error(`Invalid seed data:\n- ${errors.join("\n- ")}`);
  }
  return plan;
}

function buildReferenceSchedule(
  seed: SeedFile,
  dayCodes: Set<string>,
  sectionShiftCodes: Map<string, Set<string>>,
  errors: string[],
): SeedPlan["referenceSchedule"] {
  const reference = seed.reference_schedule;
  const { year, month } = parseMonth(
    reference?.month ?? seed._meta.demo_months[0],
  );
  const cells: SeedPlan["referenceSchedule"]["cells"] = [];
  for (const [sectionCode, grid] of Object.entries(reference?.grids ?? {})) {
    for (const [employee, codes] of Object.entries(grid)) {
      if (!seed.employees.some((e) => e.name === employee)) {
        errors.push(`Reference schedule: unknown employee "${employee}"`);
      }
      codes.forEach((code, i) => {
        const date = toIsoDate(year, month, i + 1);
        if (dayCodes.has(code)) {
          cells.push({
            employee,
            date,
            sectionCode,
            shiftCode: null,
            dayCode: code,
          });
        } else if (sectionShiftCodes.get(sectionCode)?.has(code)) {
          cells.push({
            employee,
            date,
            sectionCode,
            shiftCode: code,
            dayCode: null,
          });
        } else {
          errors.push(
            `Reference schedule: unknown code "${code}" for ${employee} on ${date}`,
          );
        }
      });
    }
  }
  return {
    year,
    month,
    note: reference?.note ?? null,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Plan → domain input with natural-key ids (used by tests and fixtures)
// ---------------------------------------------------------------------------

export const naturalShiftId = (sectionCode: string, shiftCode: string) =>
  `${sectionCode}:${shiftCode}`;

/**
 * Builds a validator input straight from the seed plan, using natural keys as ids
 * (section code, "section:shift", employee name). Mirrors what the DB loader builds.
 * Defaults to the reference month; for another month the assignments are empty.
 */
export function seedPlanToScheduleInput(
  plan: SeedPlan,
  target: { year: number; month: number } = plan.referenceSchedule,
): ScheduleInput {
  const { year, month } = target;
  const isReference =
    year === plan.referenceSchedule.year &&
    month === plan.referenceSchedule.month;
  return {
    year,
    month,
    sections: plan.sections.map((s) => ({
      id: s.code,
      code: s.code,
      name: s.name,
      sortOrder: s.sortOrder,
    })),
    shiftTypes: plan.shiftTypes.map((t) => ({
      id: naturalShiftId(t.sectionCode, t.code),
      sectionId: t.sectionCode,
      code: t.code,
      isActive: true,
      periods: t.periods,
    })),
    dayCodes: plan.dayCodes,
    employees: plan.employees.map((e) => ({
      id: e.name,
      displayName: e.name,
      primarySectionId: e.sectionCode,
      status: e.status,
      weeklyContractMinutes: e.weeklyContractMinutes,
      monthlyTlDays: e.monthlyTlDays,
      requiresMonthlyWeekendOff: e.requiresMonthlyWeekendOff,
      birthdayMonth: e.birthdayMonth,
      birthdayDay: e.birthdayDay,
      hiredOn: null,
      leftOn: null,
      fixedDaysOff: e.fixedDaysOff,
      eligibility: e.eligibility.map((el) => ({
        shiftTypeId: naturalShiftId(el.sectionCode, el.shiftCode),
        preference: el.preference,
        maxPerWeek: el.maxPerWeek,
        exactPerWeek: el.exactPerWeek,
      })),
    })),
    relations: plan.relations.map((r) => ({
      employeeAId: r.a,
      employeeBId: r.b,
      type: r.type,
    })),
    absences: plan.absences.map((a) => ({
      employeeId: a.employee,
      dayCode: a.dayCode,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
    unavailabilities: [],
    holidays: plan.holidays.map((h) => ({ date: h.date, name: h.name })),
    staffingRequirements: plan.staffingRequirements.map((r) => ({
      sectionId: r.sectionCode,
      shiftTypeId: r.shiftCode
        ? naturalShiftId(r.sectionCode, r.shiftCode)
        : null,
      weekday: r.weekday,
      minStaff: r.minStaff,
      maxStaff: null,
      validFrom: null,
      validTo: null,
    })),
    staffingOverrides: [],
    rules: plan.globalRules.map((r) => ({
      code: r.code,
      scope: "global",
      sectionId: null,
      employeeId: null,
      value: r.value,
      isHard: r.isHard,
      isActive: true,
    })),
    assignments: (isReference ? plan.referenceSchedule.cells : []).map((c) => ({
      employeeId: c.employee,
      date: c.date,
      shiftTypeId: c.shiftCode
        ? naturalShiftId(c.sectionCode, c.shiftCode)
        : null,
      dayCode: c.dayCode,
      isLocked: false,
    })),
  };
}
