import { and, eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  employees,
  scheduleAssignments,
  schedules,
  sections,
  shiftTypes,
  user,
} from "@/db/schema";
import * as appSchema from "@/db/schema/app";
import { formatMonth, toIsoDate } from "@/lib/domain/calendar";
import {
  type DemoSchedule,
  generateDemoSchedule,
  shiftSeedFile,
} from "@/lib/domain/demo-schedule";
import { buildSeedPlan, type SeedPlan } from "@/lib/domain/seed-mapping";
import { readSeedFile, seedDatabase } from "@/server/seed";

/**
 * Rolling demo: the demo months always start with the current month. When the
 * current month has no published schedule, every app table is emptied, guests are
 * removed, and the seed is imported again with its months and absences moved to the
 * current month. Every demo month gets a published schedule: the first one with the
 * deliberate mistakes, the next ones generated cleanly from the previous month's
 * last week. Every guest is removed.
 */
export async function ensureDemoMonth(target: { year: number; month: number }) {
  const [published] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.year, target.year),
        eq(schedules.month, target.month),
        eq(schedules.status, "published"),
      ),
    )
    .limit(1);
  if (published) return false;
  await resetDemoData(target);
  return true;
}

export async function resetDemoData(target: { year: number; month: number }) {
  const seed = shiftSeedFile(readSeedFile(), target);
  const demo = generateDemoSchedule(buildSeedPlan(seed));
  const plan = buildSeedPlan({
    ...seed,
    reference_schedule: {
      month: `${demo.year}-${String(demo.month).padStart(2, "0")}`,
      note: `Demo schedule. Deliberate mistakes: ${demo.mistakes.join("; ")}.`,
      grids: demo.grids,
    },
  });

  const tables = (Object.values(appSchema) as unknown[])
    .filter((value) => is(value, PgTable))
    .map((table) => `"${getTableName(table as PgTable)}"`);
  await db.execute(sql.raw(`truncate table ${tables.join(", ")} cascade`));
  await db.delete(user).where(eq(user.isAnonymous, true));
  await seedDatabase(plan);
  // The following demo months get a clean published schedule too, so visitors can
  // browse several months.
  let previous = demo;
  for (const month of plan.demoMonths.slice(1)) {
    previous = await publishGeneratedMonth(plan, month, previous);
  }
  console.info(
    `[demo] data reset: ${plan.demoMonths.map((m) => formatMonth(m.year, m.month)).join(", ")} published`,
  );
}

async function publishGeneratedMonth(
  plan: SeedPlan,
  target: { year: number; month: number },
  previous: DemoSchedule,
) {
  const demo = generateDemoSchedule(plan, target, {
    withMistakes: false,
    previous,
  });
  const [employeeRows, shiftRows] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.displayName })
      .from(employees),
    db
      .select({
        id: shiftTypes.id,
        section: sections.code,
        code: shiftTypes.code,
      })
      .from(shiftTypes)
      .innerJoin(sections, eq(sections.id, shiftTypes.sectionId)),
  ]);
  const employeeId = new Map(employeeRows.map((e) => [e.name, e.id]));
  const shiftId = new Map(
    shiftRows.map((s) => [`${s.section}/${s.code}`, s.id]),
  );
  const dayCodeSet = new Set(plan.dayCodes.map((d) => d.code));

  await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(schedules)
      .values({
        year: target.year,
        month: target.month,
        version: 1,
        status: "published",
        source: "import",
        title: `${formatMonth(target.year, target.month)} — demo schedule`,
        publishedAt: new Date(),
      })
      .returning({ id: schedules.id });
    const cells = Object.entries(demo.grids).flatMap(([section, grid]) =>
      Object.entries(grid).flatMap(([name, codes]) =>
        codes.map((code, i) => ({
          scheduleId: schedule.id,
          employeeId: employeeId.get(name) ?? "",
          date: toIsoDate(target.year, target.month, i + 1),
          shiftTypeId: dayCodeSet.has(code)
            ? null
            : (shiftId.get(`${section}/${code}`) ?? null),
          dayCode: dayCodeSet.has(code) ? code : null,
        })),
      ),
    );
    await tx
      .insert(scheduleAssignments)
      .values(
        cells.filter((c) => c.employeeId && (c.shiftTypeId || c.dayCode)),
      );
  });
  return demo;
}
