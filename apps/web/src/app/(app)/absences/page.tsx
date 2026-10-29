import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { absences } from "@/db/schema";
import { getDayCodes, getEmployees } from "@/server/queries/reference";
import { requireUser } from "@/server/session";
import { AbsencesView } from "./absences-view";

export const metadata: Metadata = { title: "Absences" };

export default async function AbsencesPage() {
  const user = await requireUser();
  const [rows, employees, dayCodes] = await Promise.all([
    db.select().from(absences).orderBy(desc(absences.startDate)),
    getEmployees(),
    getDayCodes(),
  ]);
  const nameOf = new Map(employees.map((e) => [e.id, e.displayName]));

  return (
    <>
      <PageHeader
        title="Absences"
        description="Annual leave, sick leave, birthdays, time off in lieu and other approved absences."
      />
      <AbsencesView
        canManage={user.role === "manager"}
        employees={employees.map((e) => ({
          value: e.id,
          label: e.displayName,
        }))}
        codes={dayCodes
          .filter((d) => d.kind === "absence")
          .map((d) => ({ value: d.code, label: `${d.code} — ${d.label}` }))}
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
