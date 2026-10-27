import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "@/db";
import {
  absences,
  dayCodes,
  employeeFixedDaysOff,
  employeeRelations,
  employeeShiftEligibility,
  employees,
  employeeUnavailabilities,
  holidays,
  scheduleAssignments,
  schedules,
  schedulingRules,
  sections,
  shiftTypePeriods,
  shiftTypes,
  staffingOverrides,
  staffingRequirements,
} from "@/db/schema";
import {
  addDays,
  type IsoDate,
  monthDates,
  type Weekday,
} from "@/lib/domain/calendar";
import type {
  Assignment,
  MonthContext,
  ScheduleInput,
} from "@/lib/domain/types";

/**
 * Loads everything the validator (and later the solver) needs for one month.
 * Plain module (no `server-only`) so CLI scripts such as the seed can use it.
 */
export async function loadMonthContext(
  db: Database,
  year: number,
  month: number,
): Promise<MonthContext> {
  const dates = monthDates(year, month);
  const first = dates[0];
  const last = dates[dates.length - 1];

  const [
    sectionRows,
    shiftRows,
    periodRows,
    dayCodeRows,
    employeeRows,
    fixedRows,
    eligibilityRows,
    relationRows,
    absenceRows,
    unavailabilityRows,
    holidayRows,
    requirementRows,
    overrideRows,
    ruleRows,
  ] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.sortOrder)),
    db.select().from(shiftTypes).orderBy(asc(shiftTypes.code)),
    db.select().from(shiftTypePeriods).orderBy(asc(shiftTypePeriods.position)),
    db.select().from(dayCodes),
    db.select().from(employees).orderBy(asc(employees.displayName)),
    db.select().from(employeeFixedDaysOff),
    db.select().from(employeeShiftEligibility),
    db.select().from(employeeRelations),
    db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.status, "approved"),
          lte(absences.startDate, last),
          gte(absences.endDate, first),
        ),
      ),
    db
      .select()
      .from(employeeUnavailabilities)
      .where(
        and(
          gte(employeeUnavailabilities.date, first),
          lte(employeeUnavailabilities.date, last),
        ),
      ),
    db
      .select()
      .from(holidays)
      .where(and(gte(holidays.date, first), lte(holidays.date, last))),
    db.select().from(staffingRequirements),
    db
      .select()
      .from(staffingOverrides)
      .where(
        and(
          gte(staffingOverrides.date, first),
          lte(staffingOverrides.date, last),
        ),
      ),
    db.select().from(schedulingRules),
  ]);

  return {
    year,
    month,
    sections: sectionRows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      sortOrder: s.sortOrder,
    })),
    shiftTypes: shiftRows.map((s) => ({
      id: s.id,
      sectionId: s.sectionId,
      code: s.code,
      isActive: s.isActive,
      periods: periodRows
        .filter((p) => p.shiftTypeId === s.id)
        .map((p) => ({
          startMinute: p.startMinute,
          endMinute: p.endMinute,
          unpaidBreakMinutes: p.unpaidBreakMinutes,
        })),
    })),
    dayCodes: dayCodeRows.map((d) => ({
      code: d.code,
      label: d.label,
      kind: d.kind,
      isDueDay: d.isDueDay,
      creditsTime: d.creditsTime,
    })),
    employees: employeeRows.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      primarySectionId: e.primarySectionId,
      status: e.status,
      weeklyContractMinutes: e.weeklyContractMinutes,
      monthlyTlDays: e.monthlyTlDays,
      requiresMonthlyWeekendOff: e.requiresMonthlyWeekendOff,
      birthdayMonth: e.birthdayMonth,
      birthdayDay: e.birthdayDay,
      hiredOn: e.hiredOn,
      leftOn: e.leftOn,
      fixedDaysOff: fixedRows
        .filter((f) => f.employeeId === e.id)
        .sort((a, b) => a.weekday - b.weekday)
        .map((f) => ({ weekday: f.weekday as Weekday })),
      eligibility: eligibilityRows
        .filter((el) => el.employeeId === e.id)
        .map((el) => ({
          shiftTypeId: el.shiftTypeId,
          preference: el.preference,
          maxPerWeek: el.maxPerWeek,
          exactPerWeek: el.exactPerWeek,
        })),
    })),
    relations: relationRows.map((r) => ({
      employeeAId: r.employeeAId,
      employeeBId: r.employeeBId,
      type: r.type,
    })),
    absences: absenceRows.map((a) => ({
      employeeId: a.employeeId,
      dayCode: a.dayCode,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
    unavailabilities: unavailabilityRows.map((u) => ({
      employeeId: u.employeeId,
      date: u.date,
      startMinute: u.startMinute,
      endMinute: u.endMinute,
      reason: u.reason,
    })),
    holidays: holidayRows.map((h) => ({ date: h.date, name: h.name })),
    staffingRequirements: requirementRows.map((r) => ({
      sectionId: r.sectionId,
      shiftTypeId: r.shiftTypeId,
      weekday: r.weekday as Weekday | null,
      minStaff: r.minStaff,
      maxStaff: r.maxStaff,
      validFrom: r.validFrom,
      validTo: r.validTo,
    })),
    staffingOverrides: overrideRows.map((o) => ({
      sectionId: o.sectionId,
      shiftTypeId: o.shiftTypeId,
      date: o.date,
      minStaff: o.minStaff,
      maxStaff: o.maxStaff,
      reason: o.reason,
    })),
    rules: ruleRows.map((r) => ({
      code: r.code,
      scope: r.scope,
      sectionId: r.sectionId,
      employeeId: r.employeeId,
      value: r.value,
      isHard: r.isHard,
      isActive: r.isActive,
    })),
  };
}

export async function loadAssignments(
  db: Database,
  scheduleId: string,
  range?: { from: IsoDate; to: IsoDate },
): Promise<Assignment[]> {
  const rows = await db
    .select({
      employeeId: scheduleAssignments.employeeId,
      date: scheduleAssignments.date,
      shiftTypeId: scheduleAssignments.shiftTypeId,
      dayCode: scheduleAssignments.dayCode,
      isLocked: scheduleAssignments.isLocked,
    })
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.scheduleId, scheduleId),
        range ? gte(scheduleAssignments.date, range.from) : undefined,
        range ? lte(scheduleAssignments.date, range.to) : undefined,
      ),
    );
  return rows;
}

/** Last 7 days of the previous month's published schedule, if any. */
export async function loadPreviousMonthTail(
  db: Database,
  year: number,
  month: number,
): Promise<Assignment[]> {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const [published] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.year, prevYear),
        eq(schedules.month, prevMonth),
        eq(schedules.status, "published"),
      ),
    )
    .orderBy(desc(schedules.version))
    .limit(1);
  if (!published) return [];
  const dates = monthDates(prevYear, prevMonth);
  const to = dates[dates.length - 1];
  return loadAssignments(db, published.id, { from: addDays(to, -6), to });
}

export async function loadScheduleInput(
  db: Database,
  schedule: { id: string; year: number; month: number },
): Promise<ScheduleInput> {
  const [context, assignments, previousAssignments] = await Promise.all([
    loadMonthContext(db, schedule.year, schedule.month),
    loadAssignments(db, schedule.id),
    loadPreviousMonthTail(db, schedule.year, schedule.month),
  ]);
  return { ...context, assignments, previousAssignments };
}
