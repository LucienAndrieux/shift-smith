import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { scheduleAssignments, schedules } from "@/db/schema";
import type { ConstraintOperation } from "@/lib/constraints/operations";
import { formatMonth, monthDates } from "@/lib/domain/calendar";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/session";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Demo version of "approve a constraint": shared reference data (absences, rules,
 * staffing) stays untouched; absences and forced shifts become locked cells of the
 * visitor's latest draft of the target month. Other operations are skipped.
 */
export async function applyOperationsToOwnDraft(
  tx: Tx,
  operations: readonly ConstraintOperation[],
  ctx: { user: CurrentUser; year: number; month: number; constraintId: string },
) {
  const [draft] = await tx
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.year, ctx.year),
        eq(schedules.month, ctx.month),
        eq(schedules.status, "draft"),
        eq(schedules.createdBy, ctx.user.id),
      ),
    )
    .orderBy(desc(schedules.version))
    .limit(1);
  if (!draft) {
    throw new ActionError(
      `Create or duplicate a draft of ${formatMonth(ctx.year, ctx.month)} first: in the demo, constraints are applied to your own draft.`,
    );
  }

  const days = new Set(monthDates(ctx.year, ctx.month));
  const cells: {
    employeeId: string;
    date: string;
    shiftTypeId: string | null;
    dayCode: string | null;
  }[] = [];
  let skipped = 0;
  for (const op of operations) {
    if (op.type === "absence") {
      for (const date of days) {
        if (date >= op.startDate && date <= op.endDate) {
          cells.push({
            employeeId: op.employeeId,
            date,
            shiftTypeId: null,
            dayCode: op.dayCode,
          });
        }
      }
    } else if (op.type === "shift_force") {
      if (days.has(op.date)) {
        cells.push({
          employeeId: op.employeeId,
          date: op.date,
          shiftTypeId: op.shiftTypeId,
          dayCode: null,
        });
      }
    } else if (op.type !== "unparseable") {
      skipped++;
    }
  }

  for (const cell of cells) {
    const values = {
      shiftTypeId: cell.shiftTypeId,
      dayCode: cell.dayCode,
      isLocked: true,
    };
    await tx
      .insert(scheduleAssignments)
      .values({
        scheduleId: draft.id,
        employeeId: cell.employeeId,
        date: cell.date,
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
    userId: ctx.user.id,
    action: "apply_to_draft",
    entity: "natural_language_constraint",
    entityId: ctx.constraintId,
    diff: { draft: draft.id, cells: cells.length, skipped },
  });
  return { draftVersion: draft.version, cells: cells.length, skipped };
}
