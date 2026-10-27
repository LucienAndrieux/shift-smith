import { NextResponse } from "next/server";
import { formatDateTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { renderSchedulePdf } from "@/server/pdf/schedule-pdf";
import { getScheduleView } from "@/server/queries/schedule";
import { getCurrentUser } from "@/server/session";

/**
 * PDF export of one schedule version (printable monthly sheet). Same access
 * rules as the schedule screen: read-only users only get the published version.
 * `?section=<code>` limits the export to one section.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/schedule/[year]/[month]/pdf">,
) {
  const user = await getCurrentUser();
  if (user?.accessStatus !== "approved") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { year: y, month: m } = await params;
  const year = Number(y);
  const month = Number(m);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  const search = new URL(request.url).searchParams;
  const versionParam = search.get("version");
  const version =
    versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : null;

  const view = await getScheduleView(year, month, version, {
    publishedOnly: user.role !== "admin",
  });
  if (!view.schedule) {
    return NextResponse.json(
      { error: "No schedule for this month" },
      { status: 404 },
    );
  }
  const sectionCode = search.get("section");
  const section = sectionCode
    ? view.sections.find((s) => s.code === sectionCode)
    : undefined;

  // `public/` is next to the server in dev (cwd = apps/web) and in the standalone image.
  const pdf = await renderSchedulePdf(view, {
    sectionIds: section ? [section.id] : [],
    hotelName: env().HOTEL_NAME,
    generatedAt: formatDateTime(new Date()),
  });

  const filename = `schedule-${year}-${String(month).padStart(2, "0")}-v${view.schedule.version}${
    section ? `-${section.code}` : ""
  }.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
