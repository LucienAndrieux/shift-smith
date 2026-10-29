import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { formatMonth } from "@/lib/domain/calendar";
import { getScheduleView } from "@/server/queries/schedule";
import { requireUser } from "@/server/session";
import { HoursWorkspace } from "./hours-workspace";

export async function generateMetadata({
  params,
}: PageProps<"/hours/[year]/[month]">): Promise<Metadata> {
  const { year, month } = await params;
  const y = Number(year);
  const m = Number(month);
  return {
    title: m >= 1 && m <= 12 ? `Hours · ${formatMonth(y, m)}` : "Hours",
  };
}

/** Monthly and weekly hours per employee of one schedule version. */
export default async function HoursPage({
  params,
  searchParams,
}: PageProps<"/hours/[year]/[month]">) {
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
  return <HoursWorkspace view={view} />;
}
