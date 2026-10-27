import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { hourBankEntries, schedules } from "@/db/schema";
import { monthDates } from "@/lib/domain/calendar";
import { buildClosePreview } from "@/lib/domain/hour-bank";
import { validateSchedule } from "@/lib/domain/validator";
import { loadScheduleInput } from "@/server/month-context";

export async function getPublishedSchedule(year: number, month: number) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.year, year),
        eq(schedules.month, month),
        eq(schedules.status, "published"),
      ),
    );
  return schedule ?? null;
}

/**
 * Closing preview of a published schedule. Balances count every entry dated up to
 * the end of the month, except the closing entries of this very schedule.
 */
export async function getClosePreview(schedule: {
  id: string;
  year: number;
  month: number;
}) {
  const dates = monthDates(schedule.year, schedule.month);
  const monthEnd = dates[dates.length - 1];
  const input = await loadScheduleInput(db, schedule);
  const { employeeTotals } = validateSchedule(input);

  const balances = await db
    .select({
      employeeId: hourBankEntries.employeeId,
      minutes: sql<number>`coalesce(sum(${hourBankEntries.minutes}), 0)::integer`,
    })
    .from(hourBankEntries)
    .where(
      and(
        lte(hourBankEntries.entryDate, monthEnd),
        sql`not (${hourBankEntries.kind} = 'monthly_close' and ${hourBankEntries.scheduleId} = ${schedule.id})`,
      ),
    )
    .groupBy(hourBankEntries.employeeId);

  const rows = buildClosePreview(
    employeeTotals.map((t) => ({ employeeId: t.employeeId, period: t.month })),
    new Map(balances.map((b) => [b.employeeId, b.minutes])),
  );
  const nameOf = new Map(input.employees.map((e) => [e.id, e.displayName]));
  const sectionOf = new Map(
    input.employees.map((e) => [e.id, e.primarySectionId]),
  );
  const sectionName = new Map(input.sections.map((s) => [s.id, s.name]));
  const sectionOrder = new Map(input.sections.map((s) => [s.id, s.sortOrder]));

  return {
    monthEnd,
    rows: rows
      .map((r) => ({
        ...r,
        name: nameOf.get(r.employeeId) ?? "?",
        section: sectionName.get(sectionOf.get(r.employeeId) ?? "") ?? "",
        sectionOrder: sectionOrder.get(sectionOf.get(r.employeeId) ?? "") ?? 0,
      }))
      .sort(
        (a, b) =>
          a.sectionOrder - b.sectionOrder || a.name.localeCompare(b.name),
      ),
  };
}

export type ClosePreview = Awaited<ReturnType<typeof getClosePreview>>;
