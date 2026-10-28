import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dayCodes as dayCodesTable,
  employees,
  scheduleAssignments,
  schedules,
} from "@/db/schema";
import { isWeekend, monthDates, weekday } from "@/lib/domain/calendar";
import { computeShiftDuration } from "@/lib/domain/durations";
import { formatTimeOfDay } from "@/lib/domain/time";
import { validateSchedule } from "@/lib/domain/validator";
import {
  loadMonthContext,
  loadPreviousMonthTail,
} from "@/server/month-context";
import { canSeeSchedule } from "@/server/schedules";
import type { CurrentUser } from "@/server/session";
import { getShiftTypes } from "./reference";

export type ScheduleView = Awaited<ReturnType<typeof getScheduleView>>;

/** Picks the requested version, else the published one, else the latest. */
function pickSchedule<T extends { version: number; status: string }>(
  versions: T[],
  requested: number | null,
): T | null {
  if (requested !== null) {
    const match = versions.find((v) => v.version === requested);
    if (match) return match;
  }
  return (
    versions.find((v) => v.status === "published") ??
    versions.toSorted((a, b) => b.version - a.version)[0] ??
    null
  );
}

/**
 * Everything the schedule screen needs, as plain serialisable data.
 * Only the versions the user may see are loaded (canSeeSchedule): admins see every
 * version, demo managers the published one and their own drafts, viewers the
 * published one or nothing.
 */
export async function getScheduleView(
  year: number,
  month: number,
  requestedVersion: number | null,
  { user }: { user: CurrentUser },
) {
  const versions = (
    await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.year, year), eq(schedules.month, month)))
      .orderBy(asc(schedules.version))
  ).filter((s) => canSeeSchedule(user, s));
  const schedule = pickSchedule(versions, requestedVersion);

  const [
    context,
    shiftRows,
    dayCodeRows,
    employeeRows,
    assignmentRows,
    previous,
  ] = await Promise.all([
    loadMonthContext(db, year, month),
    getShiftTypes(),
    db.select().from(dayCodesTable).orderBy(asc(dayCodesTable.code)),
    db.select().from(employees),
    schedule
      ? db
          .select()
          .from(scheduleAssignments)
          .where(eq(scheduleAssignments.scheduleId, schedule.id))
      : Promise.resolve([]),
    loadPreviousMonthTail(db, year, month),
  ]);

  const validation = validateSchedule({
    ...context,
    assignments: assignmentRows.map((a) => ({
      employeeId: a.employeeId,
      date: a.date,
      shiftTypeId: a.shiftTypeId,
      dayCode: a.dayCode,
      isLocked: a.isLocked,
    })),
    previousAssignments: previous,
  });

  const holidayByDate = new Map(context.holidays.map((h) => [h.date, h.name]));
  const employeeById = new Map(employeeRows.map((e) => [e.id, e]));
  const sectionOrder = new Map(
    context.sections.map((s) => [s.id, s.sortOrder]),
  );

  const cells: Record<
    string,
    Record<
      string,
      {
        shiftTypeId: string | null;
        dayCode: string | null;
        isLocked: boolean;
        note: string | null;
      }
    >
  > = {};
  for (const a of assignmentRows) {
    cells[a.employeeId] ??= {};
    cells[a.employeeId][a.date] = {
      shiftTypeId: a.shiftTypeId,
      dayCode: a.dayCode,
      isLocked: a.isLocked,
      note: a.note,
    };
  }

  return {
    year,
    month,
    schedule: schedule
      ? {
          id: schedule.id,
          version: schedule.version,
          status: schedule.status,
          source: schedule.source,
          title: schedule.title,
          notes: schedule.notes,
          closedAt: schedule.closedAt?.toISOString() ?? null,
          createdBy: schedule.createdBy,
        }
      : null,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      createdBy: v.createdBy,
      source: v.source,
      title: v.title,
    })),
    dates: monthDates(year, month).map((date) => ({
      date,
      day: Number(date.slice(8)),
      weekday: weekday(date),
      isWeekend: isWeekend(date),
      holiday: holidayByDate.get(date) ?? null,
    })),
    sections: context.sections,
    shiftTypes: shiftRows.map((s) => {
      let paidMinutes = 0;
      try {
        paidMinutes = computeShiftDuration(s.periods).paidMinutes;
      } catch {}
      return {
        id: s.id,
        sectionId: s.sectionId,
        code: s.code,
        label: s.label,
        color: s.color,
        isActive: s.isActive,
        toConfirm: s.toConfirm,
        paidMinutes,
        hours: s.periods
          .map(
            (p) =>
              `${formatTimeOfDay(p.startMinute)}–${formatTimeOfDay(p.endMinute)}`,
          )
          .join(" / "),
      };
    }),
    dayCodes: dayCodeRows.map((d) => ({
      code: d.code,
      label: d.label,
      kind: d.kind,
      color: d.color,
    })),
    employees: context.employees
      .filter((e) => e.status === "active")
      .map((e) => ({
        id: e.id,
        name: e.displayName,
        sectionId: e.primarySectionId,
        toConfirm: employeeById.get(e.id)?.toConfirm ?? false,
        weeklyContractMinutes: e.weeklyContractMinutes,
        eligibleShiftIds: e.eligibility.map((el) => el.shiftTypeId),
      }))
      .sort(
        (a, b) =>
          (sectionOrder.get(a.sectionId) ?? 0) -
            (sectionOrder.get(b.sectionId) ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    cells,
    coverage: validation.coverage,
    violations: validation.violations,
    totals: validation.employeeTotals,
  };
}
