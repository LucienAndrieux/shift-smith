import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { ActionError } from "./action";
import type { CurrentUser } from "./session";

type Schedule = typeof schedules.$inferSelect;

/**
 * Versions a user may see: admins see everything, demo managers the published
 * versions and their own drafts, viewers the published versions only.
 */
export function canSeeSchedule(user: CurrentUser, schedule: Schedule): boolean {
  if (user.role === "admin") return true;
  if (schedule.status === "published") return true;
  return user.role === "demo" && schedule.createdBy === user.id;
}

/**
 * A schedule the user may edit: not archived, hour bank not closed, and for demo
 * managers one of their own drafts.
 */
export async function loadEditableSchedule(
  scheduleId: string,
  user: CurrentUser,
) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule || !canSeeSchedule(user, schedule))
    throw new ActionError("Schedule not found.");
  if (
    user.role !== "admin" &&
    (schedule.status !== "draft" || schedule.createdBy !== user.id)
  ) {
    throw new ActionError(
      "In the demo you edit your own drafts: duplicate this version first.",
    );
  }
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
