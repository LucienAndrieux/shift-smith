"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleAssignments } from "@/db/schema";
import { formatDayMonth } from "@/lib/domain/calendar";
import { suggestFixes } from "@/lib/domain/repair";
import { applyFixSchema, suggestFixesSchema } from "@/lib/schemas/schedule";
import { ActionError, plannerAction } from "@/server/action";
import { audit } from "@/server/audit";
import { assertDraftQuota } from "@/server/demo/limits";
import { loadScheduleInput } from "@/server/month-context";
import {
  createDraftCopy,
  loadEditableSchedule,
  loadVisibleSchedule,
} from "@/server/schedules";

export interface FixSuggestionView {
  changes: {
    employeeId: string;
    employeeName: string;
    date: string;
    dateLabel: string;
    before: { shiftTypeId: string | null; dayCode: string | null };
    after: { shiftTypeId: string | null; dayCode: string | null };
    beforeLabel: string;
    afterLabel: string;
  }[];
  fixedErrors: number;
  newWarnings: number;
}

/** Up to five local edits that remove the given error or warning without adding any error. */
export const suggestScheduleFixes = plannerAction(
  suggestFixesSchema,
  async ({ scheduleId, violation }, user): Promise<FixSuggestionView[]> => {
    // Suggestions only read the version: any visible one, even if read-only.
    const schedule = await loadVisibleSchedule(scheduleId, user);
    const input = await loadScheduleInput(db, schedule);
    const suggestions = suggestFixes(input, violation);

    const name = new Map(input.employees.map((e) => [e.id, e.displayName]));
    const sectionOf = new Map(
      input.employees.map((e) => [e.id, e.primarySectionId]),
    );
    const sectionName = new Map(input.sections.map((s) => [s.id, s.name]));
    const shiftById = new Map(input.shiftTypes.map((s) => [s.id, s]));
    const label = (
      employeeId: string,
      value: { shiftTypeId: string | null; dayCode: string | null },
    ) => {
      if (value.dayCode) return value.dayCode;
      const shift = value.shiftTypeId ? shiftById.get(value.shiftTypeId) : null;
      if (!shift) return "empty";
      return shift.sectionId === sectionOf.get(employeeId)
        ? shift.code
        : `${sectionName.get(shift.sectionId)} ${shift.code}`;
    };

    return suggestions.map((s) => ({
      fixedErrors: s.fixedErrors,
      newWarnings: s.newWarnings,
      changes: s.changes
        .toSorted((a, b) => a.date.localeCompare(b.date))
        .map((c) => ({
          ...c,
          employeeName: name.get(c.employeeId) ?? "?",
          dateLabel: formatDayMonth(c.date),
          beforeLabel: label(c.employeeId, c.before),
          afterLabel: label(c.employeeId, c.after),
        })),
    }));
  },
  { refreshOnSuccess: false },
);

/**
 * Applies one suggestion, refusing if any cell changed since it was computed:
 * to the version itself, or to a new draft copied from it. Returns the version
 * that received the fix.
 */
export const applyScheduleFix = plannerAction(
  applyFixSchema,
  async ({ scheduleId: sourceId, target, changes }, user) => {
    let scheduleId = sourceId;
    let version: number;
    if (target === "new-draft") {
      const source = await loadVisibleSchedule(sourceId, user);
      await assertDraftQuota(user);
      const copy = await createDraftCopy(source, user);
      scheduleId = copy.id;
      version = copy.version;
    } else {
      version = (await loadEditableSchedule(sourceId, user)).version;
    }
    await db.transaction(async (tx) => {
      for (const c of changes) {
        const where = and(
          eq(scheduleAssignments.scheduleId, scheduleId),
          eq(scheduleAssignments.employeeId, c.employeeId),
          eq(scheduleAssignments.date, c.date),
        );
        const [current] = await tx
          .select()
          .from(scheduleAssignments)
          .where(where);
        const now = {
          shiftTypeId: current?.shiftTypeId ?? null,
          dayCode: current?.dayCode ?? null,
        };
        if (
          now.shiftTypeId !== c.before.shiftTypeId ||
          now.dayCode !== c.before.dayCode
        ) {
          throw new ActionError(
            "The schedule changed since this fix was computed. Refresh and try again.",
          );
        }
        if (current?.isLocked) {
          throw new ActionError("A cell of this fix is locked.");
        }
        if (!c.after.shiftTypeId && !c.after.dayCode) {
          await tx.delete(scheduleAssignments).where(where);
        } else {
          await tx
            .insert(scheduleAssignments)
            .values({
              scheduleId,
              employeeId: c.employeeId,
              date: c.date,
              ...c.after,
            })
            .onConflictDoUpdate({
              target: [
                scheduleAssignments.scheduleId,
                scheduleAssignments.employeeId,
                scheduleAssignments.date,
              ],
              set: c.after,
            });
        }
      }
      await audit(tx, {
        userId: user.id,
        action: "apply_fix",
        entity: "schedule",
        entityId: scheduleId,
        diff: { changes },
      });
    });
    return { version, createdDraft: target === "new-draft" };
  },
);
