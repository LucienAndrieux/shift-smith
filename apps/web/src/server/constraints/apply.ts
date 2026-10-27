import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  absences,
  employeeFixedDaysOff,
  employeeUnavailabilities,
  scheduleAssignments,
  schedules,
  shiftTypePeriods,
  shiftTypes,
  staffingOverrides,
} from "@/db/schema";
import type { ConstraintOperation } from "@/lib/constraints/operations";
import {
  addDays,
  diffDays,
  formatMonth,
  yearMonthOf,
} from "@/lib/domain/calendar";
import { computeShiftDuration } from "@/lib/domain/durations";
import { parseTimeOfDay } from "@/lib/domain/time";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const MAX_DAYS = 92;

function eachDate(start: string, end: string): string[] {
  const days = diffDays(start, end) + 1;
  if (days < 1 || days > MAX_DAYS) {
    throw new ActionError(`Date ranges must span 1 to ${MAX_DAYS} days.`);
  }
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/**
 * Materialises approved operations into the right tables, tagged with the
 * constraint id (`source = constraint`). Runs inside the approval transaction.
 * - shift_ban → unavailability covering the shift's hours on each date
 *   (the validator then flags any shift overlapping that window);
 * - shift_force → a locked cell in the latest draft of the month (a draft is
 *   created when the month has none).
 */
export async function applyOperations(
  tx: Tx,
  operations: ConstraintOperation[],
  ctx: { constraintId: string; userId: string; rawText: string },
) {
  const reason = (r: string | null) => r ?? ctx.rawText.slice(0, 200);
  let applied = 0;

  for (const op of operations) {
    switch (op.type) {
      case "absence": {
        const [row] = await tx
          .insert(absences)
          .values({
            employeeId: op.employeeId,
            dayCode: op.dayCode,
            startDate: op.startDate,
            endDate: op.endDate,
            status: "approved",
            source: "constraint",
            constraintId: ctx.constraintId,
            note: op.note ?? ctx.rawText.slice(0, 200),
            createdBy: ctx.userId,
          })
          .returning();
        await audit(tx, {
          userId: ctx.userId,
          action: "create",
          entity: "absence",
          entityId: row.id,
          diff: row,
        });
        applied++;
        break;
      }
      case "unavailability": {
        const rows = eachDate(op.startDate, op.endDate).map((date) => ({
          employeeId: op.employeeId,
          date,
          startMinute: op.startTime ? parseTimeOfDay(op.startTime) : null,
          endMinute: op.endTime ? parseTimeOfDay(op.endTime) : null,
          reason: reason(op.reason),
          source: "constraint" as const,
          constraintId: ctx.constraintId,
        }));
        await tx.insert(employeeUnavailabilities).values(rows);
        await audit(tx, {
          userId: ctx.userId,
          action: "create",
          entity: "employee_unavailability",
          entityId: ctx.constraintId,
          diff: { count: rows.length, ...op },
        });
        applied++;
        break;
      }
      case "shift_ban": {
        const [shift] = await tx
          .select()
          .from(shiftTypes)
          .where(eq(shiftTypes.id, op.shiftTypeId));
        if (!shift)
          throw new ActionError("Unknown shift in a shift_ban operation.");
        const periods = await tx
          .select()
          .from(shiftTypePeriods)
          .where(eq(shiftTypePeriods.shiftTypeId, op.shiftTypeId));
        const { firstStartMinute, lastEndMinute } =
          computeShiftDuration(periods);
        const rows = eachDate(op.startDate, op.endDate).map((date) => ({
          employeeId: op.employeeId,
          date,
          startMinute: firstStartMinute,
          endMinute: lastEndMinute,
          reason: `No shift ${shift.code}: ${reason(op.reason)}`,
          source: "constraint" as const,
          constraintId: ctx.constraintId,
        }));
        await tx.insert(employeeUnavailabilities).values(rows);
        await audit(tx, {
          userId: ctx.userId,
          action: "create",
          entity: "employee_unavailability",
          entityId: ctx.constraintId,
          diff: { count: rows.length, ...op },
        });
        applied++;
        break;
      }
      case "shift_force": {
        const scheduleId = await latestDraftFor(tx, op.date, ctx.userId);
        const values = {
          shiftTypeId: op.shiftTypeId,
          dayCode: null,
          isLocked: true,
          note: reason(op.reason),
        };
        await tx
          .insert(scheduleAssignments)
          .values({
            scheduleId,
            employeeId: op.employeeId,
            date: op.date,
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
        await audit(tx, {
          userId: ctx.userId,
          action: "update",
          entity: "schedule_assignment",
          entityId: `${scheduleId}:${op.employeeId}:${op.date}`,
          diff: op,
        });
        applied++;
        break;
      }
      case "days_off_change": {
        await tx
          .delete(employeeFixedDaysOff)
          .where(eq(employeeFixedDaysOff.employeeId, op.employeeId));
        const rows = [op.firstWeekday, op.secondWeekday]
          .filter((weekday) => weekday !== null)
          .map((weekday) => ({ employeeId: op.employeeId, weekday }));
        if (rows.length > 0) await tx.insert(employeeFixedDaysOff).values(rows);
        await audit(tx, {
          userId: ctx.userId,
          action: "update",
          entity: "employee_fixed_days_off",
          entityId: op.employeeId,
          diff: op,
        });
        applied++;
        break;
      }
      case "staffing_override": {
        for (const date of eachDate(op.startDate, op.endDate)) {
          const values = {
            minStaff: op.minStaff,
            maxStaff: op.maxStaff,
            reason: reason(op.reason),
          };
          await tx
            .insert(staffingOverrides)
            .values({
              sectionId: op.sectionId,
              shiftTypeId: op.shiftTypeId,
              date,
              ...values,
            })
            .onConflictDoUpdate({
              target: [
                staffingOverrides.sectionId,
                staffingOverrides.shiftTypeId,
                staffingOverrides.date,
              ],
              set: values,
            });
        }
        await audit(tx, {
          userId: ctx.userId,
          action: "upsert",
          entity: "staffing_override",
          entityId: ctx.constraintId,
          diff: op,
        });
        applied++;
        break;
      }
      case "unparseable":
        break;
    }
  }
  return applied;
}

/** Latest draft of the date's month, created empty when the month has none. */
async function latestDraftFor(
  tx: Tx,
  date: string,
  userId: string,
): Promise<string> {
  const { year, month } = yearMonthOf(date);
  const [draft] = await tx
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.year, year),
        eq(schedules.month, month),
        eq(schedules.status, "draft"),
      ),
    )
    .orderBy(desc(schedules.version))
    .limit(1);
  if (draft) return draft.id;
  const [last] = await tx
    .select({ version: schedules.version })
    .from(schedules)
    .where(and(eq(schedules.year, year), eq(schedules.month, month)))
    .orderBy(desc(schedules.version))
    .limit(1);
  const version = (last?.version ?? 0) + 1;
  const [created] = await tx
    .insert(schedules)
    .values({
      year,
      month,
      version,
      status: "draft",
      source: "manual",
      title: `${formatMonth(year, month)} — draft v${version}`,
      createdBy: userId,
    })
    .returning({ id: schedules.id });
  return created.id;
}
