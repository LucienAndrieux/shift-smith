import { and, eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { schedules, user } from "@/db/schema";
import * as appSchema from "@/db/schema/app";
import {
  generateDemoSchedule,
  shiftSeedFile,
} from "@/lib/domain/demo-schedule";
import { buildSeedPlan } from "@/lib/domain/seed-mapping";
import { readSeedFile, seedDatabase } from "@/server/seed";

/**
 * Rolling demo: the demo months always start with the current month. When the
 * current month has no published schedule, every app table is emptied, guests are
 * removed, and the seed is imported again with its months and absences moved to the
 * current month and a freshly generated reference schedule. Accounts of real users
 * (the admins) are kept.
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
  const { schedule } = await seedDatabase(plan);
  console.info(
    `[demo] data reset for ${target.year}-${String(target.month).padStart(2, "0")} (schedule v${schedule?.version ?? "-"})`,
  );
}
