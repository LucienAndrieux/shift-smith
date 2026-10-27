import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { ActionError } from "./action";

/** A schedule that may still be edited: not archived, hour bank not closed. */
export async function loadEditableSchedule(scheduleId: string) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule) throw new ActionError("Schedule not found.");
  if (schedule.status === "archived") {
    throw new ActionError(
      "Archived versions are read-only. Duplicate it into a new draft.",
    );
  }
  if (schedule.closedAt) {
    throw new ActionError(
      "The hour bank of this month is closed: the schedule is read-only.",
    );
  }
  return schedule;
}
