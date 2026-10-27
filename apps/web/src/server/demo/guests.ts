import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  naturalLanguageConstraints,
  schedules,
  solverRuns,
  user,
} from "@/db/schema";

/** Guests and everything they created disappear after this long. */
export const GUEST_TTL_HOURS = 24;

/** Deletes what the given guests created: drafts, generations, constraints. */
export async function deleteGuestWork(userIds: string[]) {
  if (userIds.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.delete(solverRuns).where(inArray(solverRuns.createdBy, userIds));
    await tx
      .delete(naturalLanguageConstraints)
      .where(inArray(naturalLanguageConstraints.createdBy, userIds));
    await tx
      .delete(schedules)
      .where(
        and(
          inArray(schedules.createdBy, userIds),
          eq(schedules.status, "draft"),
        ),
      );
  });
}

/** Removes guests older than GUEST_TTL_HOURS with their work (sessions cascade). */
export async function purgeExpiredGuests() {
  const cutoff = new Date(Date.now() - GUEST_TTL_HOURS * 60 * 60 * 1000);
  const expired = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.isAnonymous, true), lt(user.createdAt, cutoff)));
  const ids = expired.map((u) => u.id);
  await deleteGuestWork(ids);
  if (ids.length > 0) await db.delete(user).where(inArray(user.id, ids));
  return ids.length;
}
