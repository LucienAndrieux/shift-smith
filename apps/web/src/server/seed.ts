import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq, isNull } from "drizzle-orm";
import { type Database, db } from "@/db";
import {
  absences,
  dayCodes,
  employeeFixedDaysOff,
  employeeRelations,
  employeeShiftEligibility,
  employees,
  holidays,
  hourBankEntries,
  naturalLanguageConstraints,
  scheduleAssignments,
  schedules,
  schedulingRules,
  sections,
  shiftTypePeriods,
  shiftTypes,
  staffingRequirements,
} from "@/db/schema";
import { parsedConstraintSchema } from "@/lib/constraints/operations";
import { formatMonth } from "@/lib/domain/calendar";
import {
  openingBalanceDate,
  type SeedFile,
  type SeedPlan,
} from "@/lib/domain/seed-mapping";

/** docs/seed-data.json, found from the working directory (or SEED_FILE). */
export function readSeedFile(): SeedFile {
  if (process.env.SEED_FILE) {
    return JSON.parse(readFileSync(process.env.SEED_FILE, "utf8"));
  }
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "docs", "seed-data.json");
    if (existsSync(candidate))
      return JSON.parse(readFileSync(candidate, "utf8"));
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("docs/seed-data.json not found");
    dir = parent;
  }
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Idempotent import of a seed plan: every row is matched on its natural key and
 * only inserted when missing, so it can run again and never overwrites changes made
 * in the app. Returns the reference schedule (null when the plan has none) and the
 * number of rows inserted per table.
 */
export async function seedDatabase(plan: SeedPlan) {
  const counts = new Map<string, number>();
  const inserted = (table: string, n: number) => {
    if (n > 0) counts.set(table, (counts.get(table) ?? 0) + n);
  };
  const schedule = await db.transaction(async (tx) => {
    // Day codes
    const dc = await tx
      .insert(dayCodes)
      .values(plan.dayCodes)
      .onConflictDoNothing()
      .returning({ code: dayCodes.code });
    inserted("day_codes", dc.length);

    // Sections
    const sec = await tx
      .insert(sections)
      .values(plan.sections)
      .onConflictDoNothing()
      .returning({ id: sections.id });
    inserted("sections", sec.length);
    const sectionId = new Map(
      (await tx.select().from(sections)).map((s) => [s.code, s.id]),
    );
    const sectionIdOf = (code: string) =>
      must(sectionId.get(code), `section ${code}`);

    // Shift types (+ periods for newly created ones)
    for (const st of plan.shiftTypes) {
      const [created] = await tx
        .insert(shiftTypes)
        .values({
          sectionId: sectionIdOf(st.sectionCode),
          code: st.code,
          label: st.label,
          color: st.color,
          toConfirm: st.toConfirm,
          notes: st.notes,
        })
        .onConflictDoNothing()
        .returning({ id: shiftTypes.id });
      if (!created) continue;
      inserted("shift_types", 1);
      await tx.insert(shiftTypePeriods).values(
        st.periods.map((p, i) => ({
          shiftTypeId: created.id,
          position: i + 1,
          ...p,
        })),
      );
      inserted("shift_type_periods", st.periods.length);
    }
    const shiftId = new Map(
      (await tx.select().from(shiftTypes)).map((s) => [
        `${s.sectionId}:${s.code}`,
        s.id,
      ]),
    );
    const shiftIdOf = (sectionCode: string, code: string) =>
      must(
        shiftId.get(`${sectionIdOf(sectionCode)}:${code}`),
        `shift ${sectionCode}/${code}`,
      );

    // Employees, matched by display name
    for (const e of plan.employees) {
      const [created] = await tx
        .insert(employees)
        .values({
          displayName: e.name,
          fullName: e.fullName,
          employeeNumber: e.employeeNumber,
          primarySectionId: sectionIdOf(e.sectionCode),
          status: e.status,
          weeklyContractMinutes: e.weeklyContractMinutes,
          reducedSchedule: e.reducedSchedule,
          monthlyTlDays: e.monthlyTlDays,
          requiresMonthlyWeekendOff: e.requiresMonthlyWeekendOff,
          birthdayMonth: e.birthdayMonth,
          birthdayDay: e.birthdayDay,
          notes: e.notes,
          toConfirm: e.toConfirm,
        })
        .onConflictDoNothing({ target: employees.displayName })
        .returning({ id: employees.id });
      if (created) inserted("employees", 1);
    }
    const employeeId = new Map(
      (await tx.select().from(employees)).map((e) => [e.displayName, e.id]),
    );
    const employeeIdOf = (name: string) =>
      must(employeeId.get(name), `employee ${name}`);

    for (const e of plan.employees) {
      const id = employeeIdOf(e.name);
      if (e.fixedDaysOff.length > 0) {
        const rows = await tx
          .insert(employeeFixedDaysOff)
          .values(e.fixedDaysOff.map((f) => ({ employeeId: id, ...f })))
          .onConflictDoNothing()
          .returning({ weekday: employeeFixedDaysOff.weekday });
        inserted("employee_fixed_days_off", rows.length);
      }
      const rows = await tx
        .insert(employeeShiftEligibility)
        .values(
          e.eligibility.map((el) => ({
            employeeId: id,
            shiftTypeId: shiftIdOf(el.sectionCode, el.shiftCode),
            preference: el.preference,
            maxPerWeek: el.maxPerWeek,
            exactPerWeek: el.exactPerWeek,
            note: el.note,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: employeeShiftEligibility.employeeId });
      inserted("employee_shift_eligibility", rows.length);
    }

    // Relations (unique on the unordered pair + type)
    for (const r of plan.relations) {
      const rows = await tx
        .insert(employeeRelations)
        .values({
          employeeAId: employeeIdOf(r.a),
          employeeBId: employeeIdOf(r.b),
          type: r.type,
          note: r.note,
        })
        .onConflictDoNothing()
        .returning({ id: employeeRelations.id });
      inserted("employee_relations", rows.length);
    }

    // Global rules
    const rules = await tx
      .insert(schedulingRules)
      .values(
        plan.globalRules.map((r) => ({
          code: r.code,
          scope: "global" as const,
          value: r.value,
          isHard: r.isHard,
          description: r.description,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: schedulingRules.id });
    inserted("scheduling_rules", rules.length);

    // Holidays
    const hol = await tx
      .insert(holidays)
      .values(plan.holidays)
      .onConflictDoNothing()
      .returning({ id: holidays.id });
    inserted("holidays", hol.length);

    // Absences, matched on (employee, code, start, end)
    for (const a of plan.absences) {
      const values = {
        employeeId: employeeIdOf(a.employee),
        dayCode: a.dayCode,
        startDate: a.startDate,
        endDate: a.endDate,
      };
      const existing = await tx
        .select({ id: absences.id })
        .from(absences)
        .where(
          and(
            eq(absences.employeeId, values.employeeId),
            eq(absences.dayCode, values.dayCode),
            eq(absences.startDate, values.startDate),
            eq(absences.endDate, values.endDate),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;
      await tx.insert(absences).values({
        ...values,
        status: "approved",
        source: "import",
        endToConfirm: a.endToConfirm,
        note: a.note,
      });
      inserted("absences", 1);
    }

    // Staffing requirements, matched on (section, shift, weekday)
    for (const r of plan.staffingRequirements) {
      const section = sectionIdOf(r.sectionCode);
      const shift = r.shiftCode ? shiftIdOf(r.sectionCode, r.shiftCode) : null;
      const existing = await tx
        .select({ id: staffingRequirements.id })
        .from(staffingRequirements)
        .where(
          and(
            eq(staffingRequirements.sectionId, section),
            shift
              ? eq(staffingRequirements.shiftTypeId, shift)
              : isNull(staffingRequirements.shiftTypeId),
            r.weekday
              ? eq(staffingRequirements.weekday, r.weekday)
              : isNull(staffingRequirements.weekday),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;
      await tx.insert(staffingRequirements).values({
        sectionId: section,
        shiftTypeId: shift,
        weekday: r.weekday,
        minStaff: r.minStaff,
        maxStaff: r.maxStaff,
        toConfirm: r.toConfirm,
        note: r.note,
      });
      inserted("staffing_requirements", 1);
    }

    // Opening balances: one per employee (value from the notes, 0 otherwise)
    const notes = new Map(plan.openingBalances.map((b) => [b.employee, b]));
    for (const e of plan.employees) {
      const id = employeeIdOf(e.name);
      const existing = await tx
        .select({ id: hourBankEntries.id })
        .from(hourBankEntries)
        .where(
          and(
            eq(hourBankEntries.employeeId, id),
            eq(hourBankEntries.kind, "opening_balance"),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;
      const note = notes.get(e.name);
      await tx.insert(hourBankEntries).values({
        employeeId: id,
        entryDate: openingBalanceDate(plan),
        minutes: note?.minutes ?? 0,
        kind: "opening_balance",
        note: note?.note ?? "Opening balance (seed)",
      });
      inserted("hour_bank_entries", 1);
    }

    // Example constraints, matched on their text; natural keys become ids.
    for (const c of plan.exampleConstraints) {
      const existing = await tx
        .select({ id: naturalLanguageConstraints.id })
        .from(naturalLanguageConstraints)
        .where(eq(naturalLanguageConstraints.rawText, c.rawText))
        .limit(1);
      if (existing.length > 0) continue;
      const parsed = parsedConstraintSchema.parse({
        summary: c.summary,
        operations: c.operations.map(({ employee, section, shift, ...op }) => ({
          ...op,
          ...(employee !== undefined && {
            employeeId: employeeIdOf(employee),
          }),
          ...(shift !== undefined && {
            shiftTypeId: shift ? shiftIdOf(section ?? "", shift) : null,
          }),
          ...(op.type === "staffing_override" && {
            sectionId: sectionIdOf(section ?? ""),
          }),
        })),
      });
      await tx.insert(naturalLanguageConstraints).values({
        rawText: c.rawText,
        targetYear: c.targetYear,
        targetMonth: c.targetMonth,
        status: c.status,
        parsed,
        model: "example",
        reviewedAt: c.status === "parsed" ? null : new Date(),
      });
      inserted("natural_language_constraints", 1);
    }

    return seedReferenceSchedule(tx, plan, employeeIdOf, shiftIdOf, inserted);
  });
  return { schedule, counts };
}

async function seedReferenceSchedule(
  tx: Tx,
  plan: SeedPlan,
  employeeIdOf: (name: string) => string,
  shiftIdOf: (section: string, code: string) => string,
  inserted: (table: string, n: number) => void,
) {
  const { year, month, cells } = plan.referenceSchedule;
  if (cells.length === 0) return null;
  // Import only into a month without any schedule: once versions exist (even if the
  // imported one was later deleted), the app owns that month.
  const existing = await tx
    .select()
    .from(schedules)
    .where(and(eq(schedules.year, year), eq(schedules.month, month)))
    .orderBy(desc(schedules.version));
  if (existing.length > 0) {
    return existing.find((s) => s.status === "published") ?? existing[0];
  }

  const [created] = await tx
    .insert(schedules)
    .values({
      year,
      month,
      version: 1,
      status: "published",
      source: "import",
      title: `${formatMonth(year, month)} — demo reference schedule`,
      publishedAt: new Date(),
    })
    .returning();
  await tx.insert(scheduleAssignments).values(
    cells.map((c) => ({
      scheduleId: created.id,
      employeeId: employeeIdOf(c.employee),
      date: c.date,
      shiftTypeId: c.shiftCode ? shiftIdOf(c.sectionCode, c.shiftCode) : null,
      dayCode: c.dayCode,
    })),
  );
  inserted("schedules", 1);
  inserted("schedule_assignments", cells.length);
  return created;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed: missing ${what}`);
  return value;
}
