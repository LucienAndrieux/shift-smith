import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { currentYearMonth } from "@/lib/dates";
import { formatMonth } from "@/lib/domain/calendar";
import { getScheduleView } from "@/server/queries/schedule";
import { isManager, requireUser } from "@/server/session";
import { ScheduleWorkspace } from "./schedule-workspace";

export async function generateMetadata({
  params,
}: PageProps<"/schedule/[year]/[month]">): Promise<Metadata> {
  const { year, month } = await params;
  const y = Number(year);
  const m = Number(month);
  return { title: m >= 1 && m <= 12 ? formatMonth(y, m) : "Schedule" };
}

export default async function SchedulePage({
  params,
  searchParams,
}: PageProps<"/schedule/[year]/[month]">) {
  const user = await requireUser();
  const { year: yearParam, month: monthParam } = await params;
  const { version } = await searchParams;
  const year = Number(yearParam);
  const month = Number(monthParam);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) notFound();
  if (!Number.isInteger(month) || month < 1 || month > 12) notFound();
  const requested =
    typeof version === "string" && /^\d+$/.test(version)
      ? Number(version)
      : null;

  const view = await getScheduleView(year, month, requested, { user });
  await connection();
  const now = currentYearMonth();
  const manager = isManager(user);
  return (
    <ScheduleWorkspace
      view={view}
      permissions={{
        canPlan: manager,
        canPublish: manager,
        canEditCurrent: manager,
        // The solver generates months after the current one only.
        canGenerate: manager && year * 12 + month > now.year * 12 + now.month,
        ownEmployeeId: user.role === "employee" ? user.employeeId : null,
      }}
    />
  );
}
