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
    throw new ActionError((t) => t.errors.dateRangeSpan(MAX_DAYS));
  }
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/**
 * Materialises approved operations into the right tables, tagged with the
 * constraint id (`source = constraint`). Runs inside the approval transaction.
 * - shift_ban → unavailability covering the shift's hours on each date
 *   (the validator then flags any shift overlapping that window);
 * - shift_force → a locked cell in the version the manager picked (`placement`):
 *   a new draft copied from the published version, or an existing draft or
 *   published version of that month. Without a choice, the month's latest draft
 *   (a copy of the published version when it has none).
 * Returns the count of applied operations and the versions that received cells,
 * so the manager can be sent to them.
 */
export async function applyOperations(
  tx: Tx,
  operations: ConstraintOperation[],
  ctx: {
    constraintId: string;
    userId: string;
    rawText: string;
    placement?: Placement | null;
  },
) {
  const reason = (r: string | null) => r ?? ctx.rawText.slice(0, 200);
  let applied = 0;
  const versions = new Map<string, VersionRef>();
  /** New drafts already created by this approval, by month. */
  const created = new Map<string, VersionRef>();
  const versionFor = async (date: string): Promise<VersionRef> => {
    const placement = ctx.placement;
    if (placement?.kind === "version")
      return pickedVersion(tx, placement.scheduleId, date);
    const { year, month } = yearMonthOf(date);
    const key = `${year}-${month}`;
    if (placement?.kind === "new") {
      const existing = created.get(key);
      if (existing) return existing;
      const draft = await createDraftFromPublished(tx, year, month, ctx.userId);
      created.set(key, draft);
      return draft;
    }
    return (
      (await latestDraft(tx, year, month)) ??
      createDraftFromPublished(tx, year, month, ctx.userId)
    );
  };

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
        if (!shift) throw new ActionError((t) => t.errors.unknownShiftBan);
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
        const target = await versionFor(op.date);
        versions.set(target.id, target);
        const scheduleId = target.id;
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
  return { applied, versions: [...versions.values()] };
}

/** Where an approval puts forced shifts (see applyOperations). */
export type Placement =
  | { kind: "new" }
  | { kind: "version"; scheduleId: string };

export interface VersionRef {
  id: string;
  year: number;
  month: number;
  version: number;
  status: "draft" | "published";
}

/** The version the manager picked: same month as the date, still editable. */
async function pickedVersion(
  tx: Tx,
  scheduleId: string,
  date: string,
): Promise<VersionRef> {
  const [row] = await tx
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  const { year, month } = yearMonthOf(date);
  if (!row || row.year !== year || row.month !== month)
    throw new ActionError((t) => t.errors.scheduleNotFound);
  if (row.status === "archived")
    throw new ActionError((t) => t.errors.archivedReadOnly);
  if (row.closedAt) throw new ActionError((t) => t.errors.closedReadOnly);
  return {
    id: row.id,
    year,
    month,
    version: row.version,
    status: row.status,
  };
}

async function latestDraft(
  tx: Tx,
  year: number,
  month: number,
): Promise<VersionRef | null> {
  const [draft] = await tx
    .select({ id: schedules.id, version: schedules.version })
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
  return draft ? { ...draft, year, month, status: "draft" } : null;
}

/**
 * A new draft of the month: a copy (cells included) of its published version,
 * else of its latest one; empty only when the month has no version at all.
 */
async function createDraftFromPublished(
  tx: Tx,
  year: number,
  month: number,
  userId: string,
): Promise<VersionRef> {
  const versions = await tx
    .select({
      id: schedules.id,
      version: schedules.version,
      status: schedules.status,
    })
    .from(schedules)
    .where(and(eq(schedules.year, year), eq(schedules.month, month)))
    .orderBy(desc(schedules.version));
  const source =
    versions.find((v) => v.status === "published") ?? versions[0] ?? null;
  const version = (versions[0]?.version ?? 0) + 1;
  const [created] = await tx
    .insert(schedules)
    .values({
      year,
      month,
      version,
      status: "draft",
      source: "manual",
      title: source
        ? `${formatMonth(year, month)} — draft v${version} (from v${source.version})`
        : `${formatMonth(year, month)} — draft v${version}`,
      createdBy: userId,
    })
    .returning({ id: schedules.id });
  if (source) {
    const cells = await tx
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.scheduleId, source.id));
    if (cells.length > 0) {
      await tx.insert(scheduleAssignments).values(
        cells.map((c) => ({
          scheduleId: created.id,
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
      userId,
      action: "duplicate",
      entity: "schedule",
      entityId: created.id,
      diff: { from: source.id, version, cells: cells.length },
    });
  }
  return { id: created.id, year, month, version, status: "draft" };
}
