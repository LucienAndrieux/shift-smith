import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ---------------------------------------------------------------------------
// Shared columns and enums
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Nullable FK to the user who performed an action. */
const userRef = () =>
  uuid().references(() => user.id, { onDelete: "set null" });

/** Times of day are minutes from midnight, 0–1440. */
const minuteCheck = (column: AnyPgColumn) => sql`${column} between 0 and 1440`;

export const dayCodeKind = pgEnum("day_code_kind", [
  "rest",
  "absence",
  "other",
]);
export const employeeStatus = pgEnum("employee_status", ["active", "inactive"]);
export const shiftPreference = pgEnum("shift_preference", [
  "preferred",
  "normal",
  "rare",
]);
export const relationType = pgEnum("relation_type", [
  "same_days_off",
  "different_weekend_off",
]);
export const unavailabilitySource = pgEnum("unavailability_source", [
  "manual",
  "constraint",
]);
export const ruleScope = pgEnum("rule_scope", [
  "global",
  "section",
  "employee",
]);
export const holidayType = pgEnum("holiday_type", [
  "public",
  "regional",
  "company",
]);
export const absenceStatus = pgEnum("absence_status", [
  "approved",
  "cancelled",
]);
export const absenceSource = pgEnum("absence_source", [
  "import",
  "manual",
  "constraint",
]);
export const constraintStatus = pgEnum("constraint_status", [
  "pending",
  "parsed",
  "approved",
  "rejected",
  "failed",
]);
export const scheduleStatus = pgEnum("schedule_status", [
  "draft",
  "published",
  "archived",
]);
export const scheduleSource = pgEnum("schedule_source", [
  "import",
  "manual",
  "solver",
]);
export const hourBankEntryKind = pgEnum("hour_bank_entry_kind", [
  "opening_balance",
  "monthly_close",
  "manual_adjustment",
]);
export const solverRunStatus = pgEnum("solver_run_status", [
  "queued",
  "running",
  "succeeded",
  "infeasible",
  "failed",
]);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const sections = pgTable("sections", {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  coverageNote: text(),
  sortOrder: smallint().notNull().default(0),
  ...timestamps,
});

export const shiftTypes = pgTable(
  "shift_types",
  {
    id: uuid().primaryKey().defaultRandom(),
    sectionId: uuid()
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    code: text().notNull(),
    label: text().notNull(),
    color: text().notNull().default("#64748b"),
    isActive: boolean().notNull().default(true),
    toConfirm: boolean().notNull().default(false),
    notes: text(),
    ...timestamps,
  },
  (t) => [
    unique().on(t.sectionId, t.code),
    index().on(t.sectionId),
    index().on(t.isActive),
    check("shift_types_code_check", sql`${t.code} ~ '^[A-Z]$'`),
    check("shift_types_color_check", sql`${t.color} ~ '^#[0-9a-fA-F]{6}$'`),
  ],
);

export const shiftTypePeriods = pgTable(
  "shift_type_periods",
  {
    id: uuid().primaryKey().defaultRandom(),
    shiftTypeId: uuid()
      .notNull()
      .references(() => shiftTypes.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    startMinute: smallint().notNull(),
    endMinute: smallint().notNull(),
    unpaidBreakMinutes: smallint().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique().on(t.shiftTypeId, t.position),
    index().on(t.shiftTypeId),
    check("shift_type_periods_start_check", minuteCheck(t.startMinute)),
    check("shift_type_periods_end_check", minuteCheck(t.endMinute)),
    check(
      "shift_type_periods_order_check",
      sql`${t.endMinute} > ${t.startMinute}`,
    ),
    check(
      "shift_type_periods_break_check",
      sql`${t.unpaidBreakMinutes} >= 0 and ${t.unpaidBreakMinutes} < ${t.endMinute} - ${t.startMinute}`,
    ),
  ],
);

/** Paid minutes per shift type: Σ (end − start − unpaid break). */
export const shiftTypeDurations = pgView("shift_type_durations", {
  shiftTypeId: uuid().notNull(),
  paidMinutes: integer().notNull(),
  firstStartMinute: integer().notNull(),
  lastEndMinute: integer().notNull(),
}).as(
  sql`select shift_type_id,
    sum(end_minute - start_minute - unpaid_break_minutes)::integer as paid_minutes,
    min(start_minute)::integer as first_start_minute,
    max(end_minute)::integer as last_end_minute
  from shift_type_periods
  group by shift_type_id`,
);

export const dayCodes = pgTable(
  "day_codes",
  {
    code: text().primaryKey(),
    label: text().notNull(),
    kind: dayCodeKind().notNull(),
    /** Counts in the contract time owed for the day. */
    isDueDay: boolean().notNull().default(true),
    /** Credited with the daily contract time. */
    creditsTime: boolean().notNull().default(false),
    color: text().notNull().default("#9ca3af"),
    ...timestamps,
  },
  (t) => [
    // Target of the composite FK that restricts absences to kind = 'absence'.
    unique("day_codes_code_kind_unique").on(t.code, t.kind),
    check("day_codes_color_check", sql`${t.color} ~ '^#[0-9a-fA-F]{6}$'`),
  ],
);

export const holidays = pgTable("holidays", {
  id: uuid().primaryKey().defaultRandom(),
  date: date({ mode: "string" }).notNull().unique(),
  name: text().notNull(),
  type: holidayType().notNull().default("public"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export const employees = pgTable(
  "employees",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeNumber: text().unique(),
    displayName: text().notNull().unique(),
    fullName: text(),
    primarySectionId: uuid()
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    status: employeeStatus().notNull().default("active"),
    weeklyContractMinutes: smallint()
      .notNull()
      .default(37.5 * 60),
    reducedSchedule: boolean().notNull().default(false),
    monthlyTlDays: smallint().notNull().default(0),
    requiresMonthlyWeekendOff: boolean().notNull().default(false),
    birthdayMonth: smallint(),
    birthdayDay: smallint(),
    hiredOn: date({ mode: "string" }),
    leftOn: date({ mode: "string" }),
    notes: text(),
    toConfirm: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index().on(t.primarySectionId),
    index().on(t.status),
    check(
      "employees_contract_check",
      sql`${t.weeklyContractMinutes} > 0 and ${t.weeklyContractMinutes} <= 3600`,
    ),
    check("employees_tl_check", sql`${t.monthlyTlDays} between 0 and 31`),
    check(
      "employees_birthday_check",
      sql`(${t.birthdayMonth} is null and ${t.birthdayDay} is null) or (${t.birthdayMonth} between 1 and 12 and ${t.birthdayDay} between 1 and 31)`,
    ),
    check(
      "employees_dates_check",
      sql`${t.leftOn} is null or ${t.hiredOn} is null or ${t.leftOn} >= ${t.hiredOn}`,
    ),
  ],
);

export const employeeFixedDaysOff = pgTable(
  "employee_fixed_days_off",
  {
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.employeeId, t.weekday] }),
    check(
      "employee_fixed_days_off_weekday_check",
      sql`${t.weekday} between 1 and 7`,
    ),
  ],
);

export const employeeShiftEligibility = pgTable(
  "employee_shift_eligibility",
  {
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    shiftTypeId: uuid()
      .notNull()
      .references(() => shiftTypes.id, { onDelete: "cascade" }),
    preference: shiftPreference().notNull().default("normal"),
    maxPerWeek: smallint(),
    exactPerWeek: smallint(),
    note: text(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.employeeId, t.shiftTypeId] }),
    index().on(t.shiftTypeId),
    check(
      "employee_shift_eligibility_limits_check",
      sql`(${t.maxPerWeek} is null or ${t.maxPerWeek} between 0 and 7) and (${t.exactPerWeek} is null or ${t.exactPerWeek} between 0 and 7)`,
    ),
  ],
);

export const employeeRelations = pgTable(
  "employee_relations",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeAId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    employeeBId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: relationType().notNull(),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.employeeAId),
    index().on(t.employeeBId),
    check(
      "employee_relations_distinct_check",
      sql`${t.employeeAId} <> ${t.employeeBId}`,
    ),
    uniqueIndex("employee_relations_pair_unique").on(
      sql`least(${t.employeeAId}, ${t.employeeBId})`,
      sql`greatest(${t.employeeAId}, ${t.employeeBId})`,
      t.type,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Natural-language constraints (declared before the tables that reference them)
// ---------------------------------------------------------------------------

export const naturalLanguageConstraints = pgTable(
  "natural_language_constraints",
  {
    id: uuid().primaryKey().defaultRandom(),
    rawText: text().notNull(),
    targetYear: smallint().notNull(),
    targetMonth: smallint().notNull(),
    status: constraintStatus().notNull().default("pending"),
    parsed: jsonb(),
    parseError: text(),
    model: text(),
    createdBy: userRef(),
    reviewedBy: userRef(),
    reviewedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.status),
    index().on(t.targetYear, t.targetMonth),
    index().on(t.createdBy),
    index().on(t.reviewedBy),
    check(
      "natural_language_constraints_month_check",
      sql`${t.targetMonth} between 1 and 12`,
    ),
  ],
);

export const employeeUnavailabilities = pgTable(
  "employee_unavailabilities",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    startMinute: smallint(),
    endMinute: smallint(),
    reason: text(),
    source: unavailabilitySource().notNull().default("manual"),
    constraintId: uuid().references(() => naturalLanguageConstraints.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index().on(t.employeeId, t.date),
    index().on(t.date),
    index().on(t.constraintId),
    check(
      "employee_unavailabilities_window_check",
      sql`(${t.startMinute} is null and ${t.endMinute} is null) or (${t.startMinute} between 0 and 1440 and ${t.endMinute} between 0 and 1440 and ${t.endMinute} > ${t.startMinute})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Rules, absences, staffing
// ---------------------------------------------------------------------------

export const schedulingRules = pgTable(
  "scheduling_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    scope: ruleScope().notNull().default("global"),
    sectionId: uuid().references(() => sections.id, { onDelete: "cascade" }),
    employeeId: uuid().references(() => employees.id, { onDelete: "cascade" }),
    value: jsonb().notNull(),
    isHard: boolean().notNull().default(true),
    isActive: boolean().notNull().default(true),
    description: text(),
    ...timestamps,
  },
  (t) => [
    unique("scheduling_rules_target_unique")
      .on(t.code, t.scope, t.sectionId, t.employeeId)
      .nullsNotDistinct(),
    index().on(t.code),
    index().on(t.sectionId),
    index().on(t.employeeId),
    check(
      "scheduling_rules_scope_check",
      sql`(${t.scope} = 'global' and ${t.sectionId} is null and ${t.employeeId} is null)
        or (${t.scope} = 'section' and ${t.sectionId} is not null and ${t.employeeId} is null)
        or (${t.scope} = 'employee' and ${t.employeeId} is not null and ${t.sectionId} is null)`,
    ),
  ],
);

export const absences = pgTable(
  "absences",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    dayCode: text().notNull(),
    /** Always 'absence': with the composite FK it restricts day_code to absence codes. */
    dayCodeKind: dayCodeKind().notNull().default("absence"),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    status: absenceStatus().notNull().default("approved"),
    source: absenceSource().notNull().default("manual"),
    constraintId: uuid().references(() => naturalLanguageConstraints.id, {
      onDelete: "set null",
    }),
    endToConfirm: boolean().notNull().default(false),
    note: text(),
    createdBy: userRef(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "absences_day_code_fk",
      columns: [t.dayCode, t.dayCodeKind],
      foreignColumns: [dayCodes.code, dayCodes.kind],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    index().on(t.employeeId),
    index().on(t.dayCode),
    index().on(t.startDate, t.endDate),
    index().on(t.status),
    index().on(t.constraintId),
    index().on(t.createdBy),
    check("absences_kind_check", sql`${t.dayCodeKind} = 'absence'`),
    check("absences_dates_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const staffingRequirements = pgTable(
  "staffing_requirements",
  {
    id: uuid().primaryKey().defaultRandom(),
    sectionId: uuid()
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    shiftTypeId: uuid().references(() => shiftTypes.id, {
      onDelete: "cascade",
    }),
    weekday: smallint(),
    minStaff: smallint().notNull().default(0),
    maxStaff: smallint(),
    validFrom: date({ mode: "string" }),
    validTo: date({ mode: "string" }),
    toConfirm: boolean().notNull().default(false),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.sectionId),
    index().on(t.shiftTypeId),
    index().on(t.weekday),
    check(
      "staffing_requirements_weekday_check",
      sql`${t.weekday} is null or ${t.weekday} between 1 and 7`,
    ),
    check(
      "staffing_requirements_staff_check",
      sql`${t.minStaff} >= 0 and (${t.maxStaff} is null or ${t.maxStaff} >= ${t.minStaff})`,
    ),
    check(
      "staffing_requirements_validity_check",
      sql`${t.validFrom} is null or ${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`,
    ),
  ],
);

export const staffingOverrides = pgTable(
  "staffing_overrides",
  {
    id: uuid().primaryKey().defaultRandom(),
    sectionId: uuid()
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    shiftTypeId: uuid().references(() => shiftTypes.id, {
      onDelete: "cascade",
    }),
    date: date({ mode: "string" }).notNull(),
    minStaff: smallint().notNull().default(0),
    maxStaff: smallint(),
    reason: text(),
    ...timestamps,
  },
  (t) => [
    unique("staffing_overrides_target_unique")
      .on(t.sectionId, t.shiftTypeId, t.date)
      .nullsNotDistinct(),
    index().on(t.sectionId),
    index().on(t.shiftTypeId),
    index().on(t.date),
    check(
      "staffing_overrides_staff_check",
      sql`${t.minStaff} >= 0 and (${t.maxStaff} is null or ${t.maxStaff} >= ${t.minStaff})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export const schedules = pgTable(
  "schedules",
  {
    id: uuid().primaryKey().defaultRandom(),
    year: smallint().notNull(),
    month: smallint().notNull(),
    version: smallint().notNull(),
    status: scheduleStatus().notNull().default("draft"),
    source: scheduleSource().notNull().default("manual"),
    title: text(),
    notes: text(),
    createdBy: userRef(),
    publishedAt: timestamp({ withTimezone: true }),
    /** Set when the hour bank of this month was closed from this schedule. */
    closedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.year, t.month, t.version),
    uniqueIndex("schedules_one_published_per_month")
      .on(t.year, t.month)
      .where(sql`${t.status} = 'published'`),
    index().on(t.year, t.month),
    index().on(t.status),
    index().on(t.createdBy),
    check("schedules_month_check", sql`${t.month} between 1 and 12`),
    check("schedules_version_check", sql`${t.version} >= 1`),
  ],
);

export const scheduleAssignments = pgTable(
  "schedule_assignments",
  {
    id: uuid().primaryKey().defaultRandom(),
    scheduleId: uuid()
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    shiftTypeId: uuid().references(() => shiftTypes.id, {
      onDelete: "restrict",
    }),
    dayCode: text().references(() => dayCodes.code, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    /** Manual decision the solver must keep. */
    isLocked: boolean().notNull().default(false),
    note: text(),
    ...timestamps,
  },
  (t) => [
    unique().on(t.scheduleId, t.employeeId, t.date),
    index().on(t.scheduleId),
    index().on(t.employeeId, t.date),
    index().on(t.shiftTypeId),
    index().on(t.dayCode),
    check(
      "schedule_assignments_one_value_check",
      sql`(${t.shiftTypeId} is null) <> (${t.dayCode} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Hour bank, solver, audit
// ---------------------------------------------------------------------------

export const hourBankEntries = pgTable(
  "hour_bank_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    entryDate: date({ mode: "string" }).notNull(),
    /** Signed minutes: + owed to the employee, − taken. */
    minutes: integer().notNull(),
    kind: hourBankEntryKind().notNull(),
    scheduleId: uuid().references(() => schedules.id, { onDelete: "restrict" }),
    note: text(),
    createdBy: userRef(),
    ...timestamps,
  },
  (t) => [
    index().on(t.employeeId, t.entryDate),
    index().on(t.kind),
    index().on(t.scheduleId),
    index().on(t.createdBy),
    // One closing entry per employee and schedule.
    uniqueIndex("hour_bank_entries_close_unique")
      .on(t.employeeId, t.scheduleId)
      .where(sql`${t.kind} = 'monthly_close'`),
  ],
);

export const solverRuns = pgTable(
  "solver_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    year: smallint().notNull(),
    month: smallint().notNull(),
    scheduleId: uuid().references(() => schedules.id, { onDelete: "set null" }),
    status: solverRunStatus().notNull().default("queued"),
    input: jsonb(),
    output: jsonb(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    createdBy: userRef(),
    ...timestamps,
  },
  (t) => [
    index().on(t.year, t.month),
    index().on(t.scheduleId),
    index().on(t.status),
    index().on(t.createdBy),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    diff: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.userId),
    index().on(t.entity, t.entityId),
    index().on(t.createdAt),
  ],
);
