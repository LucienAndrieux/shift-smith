// No "server-only" marker: also used by the background job worker (instrumentation).
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dayCodes,
  employeeFixedDaysOff,
  employees,
  sections,
  shiftTypePeriods,
  shiftTypes,
} from "@/db/schema";
import { computeShiftDuration } from "@/lib/domain/durations";

export async function getSections() {
  return db.select().from(sections).orderBy(asc(sections.sortOrder));
}

export type SectionRow = Awaited<ReturnType<typeof getSections>>[number];

export async function getDayCodes() {
  return db.select().from(dayCodes).orderBy(asc(dayCodes.code));
}

export type DayCodeRow = Awaited<ReturnType<typeof getDayCodes>>[number];

/** Shift types with their periods and computed paid minutes, ordered by section. */
export async function getShiftTypes() {
  const [rows, periods, sectionRows] = await Promise.all([
    db.select().from(shiftTypes).orderBy(asc(shiftTypes.code)),
    db.select().from(shiftTypePeriods).orderBy(asc(shiftTypePeriods.position)),
    getSections(),
  ]);
  const sectionById = new Map(sectionRows.map((s) => [s.id, s]));
  return rows
    .map((st) => {
      const own = periods.filter((p) => p.shiftTypeId === st.id);
      let paidMinutes = 0;
      let firstStartMinute = 0;
      let lastEndMinute = 0;
      try {
        ({ paidMinutes, firstStartMinute, lastEndMinute } =
          computeShiftDuration(own));
      } catch {
        // Invalid periods are surfaced in the editor; count as 0 here.
      }
      const section = sectionById.get(st.sectionId);
      return {
        ...st,
        sectionCode: section?.code ?? "",
        sectionName: section?.name ?? "",
        sectionSortOrder: section?.sortOrder ?? 0,
        periods: own,
        paidMinutes,
        firstStartMinute,
        lastEndMinute,
      };
    })
    .sort(
      (a, b) =>
        a.sectionSortOrder - b.sectionSortOrder || a.code.localeCompare(b.code),
    );
}

export type ShiftTypeRow = Awaited<ReturnType<typeof getShiftTypes>>[number];

export async function getEmployees() {
  const [rows, fixed, sectionRows] = await Promise.all([
    db.select().from(employees).orderBy(asc(employees.displayName)),
    db.select().from(employeeFixedDaysOff),
    getSections(),
  ]);
  const sectionById = new Map(sectionRows.map((s) => [s.id, s]));
  return rows.map((e) => ({
    ...e,
    sectionName: sectionById.get(e.primarySectionId)?.name ?? "",
    sectionSortOrder: sectionById.get(e.primarySectionId)?.sortOrder ?? 0,
    fixedDaysOff: fixed
      .filter((f) => f.employeeId === e.id)
      .sort((a, b) => a.weekday - b.weekday),
  }));
}

export type EmployeeRow = Awaited<ReturnType<typeof getEmployees>>[number];

export async function getEmployee(id: string) {
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  return row ?? null;
}
