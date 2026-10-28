import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import {
  employeeShiftEligibility,
  scheduleAssignments,
  schedules,
  shiftTypePeriods,
} from "@/db/schema";
import type { ConstraintOperation } from "@/lib/constraints/operations";
import { addDays, formatMonth } from "@/lib/domain/calendar";
import { REST_DAY } from "@/lib/domain/day-codes";
import { MINUTES_PER_DAY, parseTimeOfDay } from "@/lib/domain/time";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/session";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface CellChange {
  employeeId: string;
  date: string;
  shiftTypeId: string | null;
  dayCode: string | null;
}

const PREFERENCE_ORDER = { preferred: 0, normal: 1, rare: 2 } as const;

/** Every date of an inclusive range. */
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end && dates.length < 366; d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates;
}

const monthKey = (date: string) => date.slice(0, 7);

/**
 * Demo version of "approve a constraint": shared reference data (absences, rules,
 * staffing) stays untouched; the operations change the visitor's own drafts, the
 * latest one of each month the operation dates fall in:
 * - absence → the day code on each day, locked;
 * - shift_force → that shift, locked;
 * - unavailability / shift_ban → a planned shift that overlaps the window (or is
 *   banned) is replaced by another eligible shift that does not, or by a rest day,
 *   locked;
 * - fixed days off and staffing changes are reference data: skipped.
 */
export async function applyOperationsToOwnDraft(
  tx: Tx,
  operations: readonly ConstraintOperation[],
  ctx: { user: CurrentUser; constraintId: string },
) {
  const months = new Set<string>();
  for (const op of operations) {
    if ("startDate" in op && "endDate" in op) {
      for (const d of datesBetween(op.startDate, op.endDate))
        months.add(monthKey(d));
    } else if ("date" in op) {
      months.add(monthKey(op.date));
    }
  }

  // The visitor's latest draft of each month touched.
  const drafts = new Map<string, { id: string; version: number }>();
  for (const key of months) {
    const [year, month] = key.split("-").map(Number);
    const [draft] = await tx
      .select({ id: schedules.id, version: schedules.version })
      .from(schedules)
      .where(
        and(
          eq(schedules.year, year),
          eq(schedules.month, month),
          eq(schedules.status, "draft"),
          eq(schedules.createdBy, ctx.user.id),
        ),
      )
      .orderBy(desc(schedules.version))
      .limit(1);
    if (!draft) {
      throw new ActionError(
        `You have no draft of ${formatMonth(year, month)} yet: open that month and click "Duplicate" (or "Generate"), then approve again. In the demo, constraints only change your own drafts.`,
      );
    }
    drafts.set(key, draft);
  }

  // Current cells, shift periods and eligibility for the shift replacements.
  const draftIds = [...drafts.values()].map((d) => d.id);
  const [cellRows, periodRows, eligibilityRows] = await Promise.all([
    draftIds.length > 0
      ? tx
          .select()
          .from(scheduleAssignments)
          .where(inArray(scheduleAssignments.scheduleId, draftIds))
      : Promise.resolve([]),
    tx.select().from(shiftTypePeriods).orderBy(asc(shiftTypePeriods.position)),
    tx.select().from(employeeShiftEligibility),
  ]);
  const current = new Map(
    cellRows.map((c) => [`${c.employeeId}|${c.date}`, c.shiftTypeId]),
  );
  const periods = new Map<string, { start: number; end: number }[]>();
  for (const p of periodRows) {
    const list = periods.get(p.shiftTypeId) ?? [];
    list.push({ start: p.startMinute, end: p.endMinute });
    periods.set(p.shiftTypeId, list);
  }
  const overlaps = (shiftTypeId: string, start: number, end: number) =>
    (periods.get(shiftTypeId) ?? []).some(
      (p) => p.start < end && p.end > start,
    );

  /** Another eligible shift accepted by `ok`, preferred first; else a rest day. */
  const replacement = (
    employeeId: string,
    ok: (shiftTypeId: string) => boolean,
  ): Omit<CellChange, "employeeId" | "date"> => {
    const shift = eligibilityRows
      .filter((e) => e.employeeId === employeeId && ok(e.shiftTypeId))
      .sort(
        (a, b) =>
          PREFERENCE_ORDER[a.preference] - PREFERENCE_ORDER[b.preference],
      )[0];
    return shift
      ? { shiftTypeId: shift.shiftTypeId, dayCode: null }
      : { shiftTypeId: null, dayCode: REST_DAY };
  };

  const changes: CellChange[] = [];
  let skipped = 0;
  for (const op of operations) {
    switch (op.type) {
      case "absence":
        for (const date of datesBetween(op.startDate, op.endDate)) {
          changes.push({
            employeeId: op.employeeId,
            date,
            shiftTypeId: null,
            dayCode: op.dayCode,
          });
        }
        break;
      case "shift_force":
        changes.push({
          employeeId: op.employeeId,
          date: op.date,
          shiftTypeId: op.shiftTypeId,
          dayCode: null,
        });
        break;
      case "unavailability": {
        const start = op.startTime ? parseTimeOfDay(op.startTime) : 0;
        const end = op.endTime ? parseTimeOfDay(op.endTime) : MINUTES_PER_DAY;
        for (const date of datesBetween(op.startDate, op.endDate)) {
          const shift = current.get(`${op.employeeId}|${date}`);
          if (!shift || !overlaps(shift, start, end)) continue;
          changes.push({
            employeeId: op.employeeId,
            date,
            ...replacement(op.employeeId, (s) => !overlaps(s, start, end)),
          });
        }
        break;
      }
      case "shift_ban":
        for (const date of datesBetween(op.startDate, op.endDate)) {
          if (current.get(`${op.employeeId}|${date}`) !== op.shiftTypeId)
            continue;
          changes.push({
            employeeId: op.employeeId,
            date,
            ...replacement(op.employeeId, (s) => s !== op.shiftTypeId),
          });
        }
        break;
      case "unparseable":
        break;
      default:
        skipped++;
    }
  }

  for (const change of changes) {
    const draft = drafts.get(monthKey(change.date));
    if (!draft) continue;
    const values = {
      shiftTypeId: change.shiftTypeId,
      dayCode: change.dayCode,
      isLocked: true,
    };
    await tx
      .insert(scheduleAssignments)
      .values({
        scheduleId: draft.id,
        employeeId: change.employeeId,
        date: change.date,
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
    diff: { drafts: draftIds, cells: changes.length, skipped },
  });
  return { cells: changes.length, skipped };
}
