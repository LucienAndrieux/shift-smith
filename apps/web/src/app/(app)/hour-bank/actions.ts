"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hourBankEntries, schedules } from "@/db/schema";
import { formatMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { scheduleIdSchema } from "@/lib/schemas/schedule";
import { ActionError, adminAction } from "@/server/action";
import { audit } from "@/server/audit";
import { getClosePreview } from "@/server/queries/hour-bank";

/**
 * Writes one monthly_close entry per employee with a complete month, computed again
 * on the server (the preview shown to the admin is never trusted).
 */
export const closeMonth = adminAction(
  scheduleIdSchema,
  async ({ scheduleId }, user) => {
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!schedule) throw new ActionError("Schedule not found.");
    if (schedule.status !== "published") {
      throw new ActionError(
        "Only the published schedule of a month can be closed.",
      );
    }
    if (schedule.closedAt)
      throw new ActionError("This month is already closed.");

    const preview = await getClosePreview(schedule);
    const included = preview.rows.filter((r) => r.included);
    const label = formatMonth(schedule.year, schedule.month);

    await db.transaction(async (tx) => {
      // Re-check inside the transaction to avoid a double close.
      const [fresh] = await tx
        .select({ closedAt: schedules.closedAt })
        .from(schedules)
        .where(eq(schedules.id, scheduleId))
        .for("update");
      if (fresh?.closedAt)
        throw new ActionError("This month is already closed.");

      if (included.length > 0) {
        await tx.insert(hourBankEntries).values(
          included.map((r) => ({
            employeeId: r.employeeId,
            entryDate: preview.monthEnd,
            minutes: r.period.deltaMinutes,
            kind: "monthly_close" as const,
            scheduleId,
            createdBy: user.id,
            note: `${label} closing (v${schedule.version}): worked ${formatHoursMinutes(r.period.workedMinutes)} + credited ${formatHoursMinutes(r.period.creditedMinutes)} − expected ${formatHoursMinutes(r.period.expectedMinutes)}`,
          })),
        );
      }
      await tx
        .update(schedules)
        .set({ closedAt: new Date() })
        .where(eq(schedules.id, scheduleId));
      await audit(tx, {
        userId: user.id,
        action: "close_month",
        entity: "schedule",
        entityId: scheduleId,
        diff: {
          entries: included.map((r) => ({
            employeeId: r.employeeId,
            minutes: r.period.deltaMinutes,
          })),
          excluded: preview.rows
            .filter((r) => !r.included)
            .map((r) => r.employeeId),
        },
      });
    });
    return {
      written: included.length,
      excluded: preview.rows.length - included.length,
    };
  },
);

/** Deletes the closing entries of a month so it can be corrected and closed again. */
export const reopenMonth = adminAction(
  scheduleIdSchema,
  async ({ scheduleId }, user) => {
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!schedule?.closedAt) throw new ActionError("This month is not closed.");
    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(hourBankEntries)
        .where(
          and(
            eq(hourBankEntries.scheduleId, scheduleId),
            eq(hourBankEntries.kind, "monthly_close"),
          ),
        )
        .returning();
      await tx
        .update(schedules)
        .set({ closedAt: null })
        .where(eq(schedules.id, scheduleId));
      await audit(tx, {
        userId: user.id,
        action: "reopen_month",
        entity: "schedule",
        entityId: scheduleId,
        diff: { deletedEntries: deleted },
      });
    });
  },
);
