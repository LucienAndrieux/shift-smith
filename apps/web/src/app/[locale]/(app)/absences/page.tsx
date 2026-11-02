import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { absences } from "@/db/schema";
import { dayCodeLabel } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";
import { getDayCodes, getEmployees } from "@/server/queries/reference";
import { requireUser } from "@/server/session";
import { AbsencesView } from "./absences-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.absences };
}

export default async function AbsencesPage() {
  const user = await requireUser();
  const t = await getT();
  const [rows, employees, dayCodes] = await Promise.all([
    db.select().from(absences).orderBy(desc(absences.startDate)),
    getEmployees(),
    getDayCodes(),
  ]);
  const nameOf = new Map(employees.map((e) => [e.id, e.displayName]));

  return (
    <>
      <PageHeader title={t.nav.absences} description={t.absences.pageText} />
      <AbsencesView
        canManage={user.role === "manager"}
        employees={employees.map((e) => ({
          value: e.id,
          label: e.displayName,
        }))}
        codes={dayCodes
          .filter((d) => d.kind === "absence")
          .map((d) => ({
            value: d.code,
            label: `${d.code} — ${dayCodeLabel(t, d.code, d.label)}`,
          }))}
        rows={rows.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          employeeName: nameOf.get(a.employeeId) ?? "?",
          dayCode: a.dayCode,
          startDate: a.startDate,
          endDate: a.endDate,
          status: a.status,
          source: a.source,
          endToConfirm: a.endToConfirm,
          note: a.note,
        }))}
      />
    </>
  );
}
