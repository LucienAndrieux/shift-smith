import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { formatMonth } from "@/lib/domain/calendar";
import { getScheduleView } from "@/server/queries/schedule";
import { requireApprovedUser } from "@/server/session";
import { ValidationWorkspace } from "./validation-workspace";

export async function generateMetadata({
  params,
}: PageProps<"/validation/[year]/[month]">): Promise<Metadata> {
  const { year, month } = await params;
  const y = Number(year);
  const m = Number(month);
  return {
    title:
      m >= 1 && m <= 12 ? `Validation · ${formatMonth(y, m)}` : "Validation",
  };
}

/** Validation of one schedule version: violations by rule, Fix, hour totals. */
export default async function ValidationPage({
  params,
  searchParams,
}: PageProps<"/validation/[year]/[month]">) {
  const user = await requireApprovedUser();
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

  let view = await getScheduleView(year, month, requested, { user });
  // Without an explicit version, open the latest draft the user can fix.
  const editableDraft =
    requested === null
      ? view.versions
          .filter(
            (v) =>
              v.status === "draft" &&
              (user.role === "admin" ||
                (user.role === "demo" && v.createdBy === user.id)),
          )
          .at(-1)
      : undefined;
  if (editableDraft && editableDraft.version !== view.schedule?.version) {
    view = await getScheduleView(year, month, editableDraft.version, { user });
  }
  await connection();
  const schedule = view.schedule;
  const editable =
    schedule !== null &&
    schedule.status !== "archived" &&
    schedule.closedAt === null &&
    (user.role === "admin" ||
      (user.role === "demo" &&
        schedule.status === "draft" &&
        schedule.createdBy === user.id));
  return <ValidationWorkspace view={view} canEdit={editable} />;
}
