import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { schedules } from "@/db/schema";

// No "server-only" marker: also used by the background job worker.

/** Next free version number for a month. */
export async function nextScheduleVersion(year: number, month: number) {
  const [row] = await db
    .select({ version: max(schedules.version) })
    .from(schedules)
    .where(and(eq(schedules.year, year), eq(schedules.month, month)));
  return (row?.version ?? 0) + 1;
}
