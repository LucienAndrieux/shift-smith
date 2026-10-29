"use server";

import { and, eq, max, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  dayCodes,
  scheduleAssignments,
  schedules,
  shiftTypes,
} from "@/db/schema";
import { formatMonth } from "@/lib/domain/calendar";
import { prefillAssignments } from "@/lib/domain/prefill";
import {
  decodeCellValue,
  newDraftSchema,
  scheduleIdSchema,
  setCellSchema,
} from "@/lib/schemas/schedule";
import { ActionError, managerAction } from "@/server/action";
import { audit } from "@/server/audit";
import { loadMonthContext } from "@/server/month-context";
import {
  canSeeSchedule,
  createDraftCopy,
  loadEditableSchedule,
} from "@/server/schedules";

async function nextVersion(year: number, month: number) {
  const [row] = await db
    .select({ version: max(schedules.version) })
    .from(schedules)
    .where(and(eq(schedules.year, year), eq(schedules.month, month)));
  return (row?.version ?? 0) + 1;
}

export const setCell = managerAction(setCellSchema, async (input, user) => {
  const schedule = await loadEditableSchedule(input.scheduleId, user);
  const { shiftTypeId, dayCode } = decodeCellValue(input.value);
  if (
    input.date.slice(0, 7) !==
    `${schedule.year}-${String(schedule.month).padStart(2, "0")}`
  ) {
    throw new ActionError("The date is outside this schedule's month.");
  }
  if (shiftTypeId) {
    const [shift] = await db
      .select()
      .from(shiftTypes)
      .where(eq(shiftTypes.id, shiftTypeId));
    if (!shift) throw new ActionError("Unknown shift.");
  }
  if (dayCode) {
    const [code] = await db
      .select()
      .from(dayCodes)
      .where(eq(dayCodes.code, dayCode));
    if (!code) throw new ActionError("Unknown day code.");
  }

  await db.transaction(async (tx) => {
    const where = and(
      eq(scheduleAssignments.scheduleId, input.scheduleId),
      eq(scheduleAssignments.employeeId, input.employeeId),
      eq(scheduleAssignments.date, input.date),
    );
    const [before] = await tx.select().from(scheduleAssignments).where(where);
    if (!shiftTypeId && !dayCode) {
      await tx.delete(scheduleAssignments).where(where);
    } else {
      const values = {
        shiftTypeId,
        dayCode,
        isLocked: input.isLocked,
        note: input.note,
      };
      await tx
        .insert(scheduleAssignments)
        .values({
          scheduleId: input.scheduleId,
          employeeId: input.employeeId,
          date: input.date,
          ...values,
        })
        .onConflictDoUpdate({
          target: [
            scheduleAssignments.scheduleId,
            scheduleAssignments.employeeId,
            scheduleAssignments.date,
          ],
          set: values,
        });
    }
    await audit(tx, {
      userId: user.id,
      action: "update",
      entity: "schedule_assignment",
      entityId: `${input.scheduleId}:${input.employeeId}:${input.date}`,
      diff: {
        from: before
          ? {
              shiftTypeId: before.shiftTypeId,
              dayCode: before.dayCode,
              isLocked: before.isLocked,
              note: before.note,
            }
          : null,
        to:
          shiftTypeId || dayCode
            ? {
                shiftTypeId,
                dayCode,
                isLocked: input.isLocked,
                note: input.note,
              }
            : null,
      },
    });
  });
});

export const createDraft = managerAction(
  newDraftSchema,
  async ({ year, month, prefill }, user) => {
    const version = await nextVersion(year, month);
    const cells = prefill
      ? prefillAssignments(await loadMonthContext(db, year, month))
      : [];
    return db.transaction(async (tx) => {
      const [schedule] = await tx
        .insert(schedules)
        .values({
          year,
          month,
          version,
          status: "draft",
          source: "manual",
          title: `${formatMonth(year, month)} — draft v${version}`,
          createdBy: user.id,
        })
        .returning();
      if (cells.length > 0) {
        await tx
          .insert(scheduleAssignments)
          .values(cells.map((c) => ({ ...c, scheduleId: schedule.id })));
      }
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "schedule",
        entityId: schedule.id,
        diff: { year, month, version, prefilledCells: cells.length },
      });
      return { id: schedule.id, version };
    });
  },
);

export const duplicateSchedule = managerAction(
  scheduleIdSchema,
  async ({ scheduleId }, user) => {
    const [source] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!source || !canSeeSchedule(user, source))
      throw new ActionError("Schedule not found.");
    const copy = await createDraftCopy(source, user);
    return { id: copy.id, version: copy.version };
  },
);

export const publishSchedule = managerAction(
  scheduleIdSchema,
  async ({ scheduleId }, user) => {
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!schedule) throw new ActionError("Schedule not found.");
    if (schedule.status === "published") return;
    const [closed] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.year, schedule.year),
          eq(schedules.month, schedule.month),
          eq(schedules.status, "published"),
        ),
      );
    await db.transaction(async (tx) => {
      if (closed) {
        const [current] = await tx
          .select()
          .from(schedules)
          .where(eq(schedules.id, closed.id));
        if (current?.closedAt) {
          throw new ActionError(
            "The hour bank was closed from the published version. Reopen the month first.",
          );
        }
      }
      // Archive the currently published version first (one published per month).
      await tx
        .update(schedules)
        .set({ status: "archived" })
        .where(
          and(
            eq(schedules.year, schedule.year),
            eq(schedules.month, schedule.month),
            eq(schedules.status, "published"),
            ne(schedules.id, scheduleId),
          ),
        );
      await tx
        .update(schedules)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(schedules.id, scheduleId));
      await audit(tx, {
        userId: user.id,
        action: "publish",
        entity: "schedule",
        entityId: scheduleId,
        diff: { version: schedule.version, archived: closed?.id ?? null },
      });
    });
  },
);

export const deleteDraft = managerAction(
  scheduleIdSchema,
  async ({ scheduleId }, user) => {
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!schedule || !canSeeSchedule(user, schedule))
      throw new ActionError("Schedule not found.");
    if (schedule.status !== "draft")
      throw new ActionError("Only drafts can be deleted.");
    await db.transaction(async (tx) => {
      await tx.delete(schedules).where(eq(schedules.id, scheduleId));
      await audit(tx, {
        userId: user.id,
        action: "delete",
        entity: "schedule",
        entityId: scheduleId,
        diff: {
          year: schedule.year,
          month: schedule.month,
          version: schedule.version,
        },
      });
    });
  },
);
