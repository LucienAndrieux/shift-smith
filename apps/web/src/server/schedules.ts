import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleAssignments, schedules } from "@/db/schema";
import { formatMonth } from "@/lib/domain/calendar";
import { ActionError } from "./action";
import { audit } from "./audit";
import { nextScheduleVersion } from "./schedule-versions";
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
 * managers one of their own drafts (or the published version when
 * `allowPublished`, used by Fix; the demo data is restored every night).
 */
export async function loadEditableSchedule(
  scheduleId: string,
  user: CurrentUser,
  { allowPublished = false }: { allowPublished?: boolean } = {},
) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule || !canSeeSchedule(user, schedule))
    throw new ActionError("Schedule not found.");
  const ownDraft =
    schedule.status === "draft" && schedule.createdBy === user.id;
  const publishedFix = allowPublished && schedule.status === "published";
  if (user.role !== "admin" && !ownDraft && !publishedFix) {
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

/** Copies a version (cells included) into a new draft owned by the user. */
export async function createDraftCopy(source: Schedule, user: CurrentUser) {
  const version = await nextScheduleVersion(source.year, source.month);
  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(schedules)
      .values({
        year: source.year,
        month: source.month,
        version,
        status: "draft",
        source: "manual",
        title: `${formatMonth(source.year, source.month)} — draft v${version} (from v${source.version})`,
        notes: source.notes,
        createdBy: user.id,
      })
      .returning();
    const cells = await tx
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.scheduleId, source.id));
    if (cells.length > 0) {
      await tx.insert(scheduleAssignments).values(
        cells.map((c) => ({
          scheduleId: copy.id,
          employeeId: c.employeeId,
          date: c.date,
          shiftTypeId: c.shiftTypeId,
          dayCode: c.dayCode,
          isLocked: c.isLocked,
          note: c.note,
        })),
      );
    }
    await audit(tx, {
      userId: user.id,
      action: "duplicate",
      entity: "schedule",
      entityId: copy.id,
      diff: { from: source.id, version, cells: cells.length },
    });
    return copy;
  });
}

/** A version the user may see (read-only use such as fix suggestions). */
export async function loadVisibleSchedule(
  scheduleId: string,
  user: CurrentUser,
) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule || !canSeeSchedule(user, schedule))
    throw new ActionError("Schedule not found.");
  return schedule;
}
