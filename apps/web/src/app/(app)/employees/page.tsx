import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { hourBankEntries } from "@/db/schema";
import { getEmployees, getSections } from "@/server/queries/reference";
import { requireApprovedUser } from "@/server/session";
import { EmployeeFormDialog } from "./employee-form";
import { EmployeesTable } from "./employees-table";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const user = await requireApprovedUser();
  const [employees, sections, balances] = await Promise.all([
    getEmployees(),
    getSections(),
    db
      .select({
        employeeId: hourBankEntries.employeeId,
        minutes: sql<number>`sum(${hourBankEntries.minutes})::integer`,
      })
      .from(hourBankEntries)
      .groupBy(hourBankEntries.employeeId),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.employeeId, b.minutes]));
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }));

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${employees.filter((e) => e.status === "active").length} active employees`}
        actions={
          user.role === "admin" && (
            <EmployeeFormDialog sections={sectionOptions} />
          )
        }
      />
      <EmployeesTable
        rows={employees.map((e) => ({
          id: e.id,
          name: e.displayName,
          employeeNumber: e.employeeNumber,
          section: e.sectionName,
          sectionOrder: e.sectionSortOrder,
          status: e.status,
          weeklyContractMinutes: e.weeklyContractMinutes,
          reducedSchedule: e.reducedSchedule,
          fixedDaysOff: e.fixedDaysOff.map((f) => ({ weekday: f.weekday })),
          monthlyTlDays: e.monthlyTlDays,
          requiresMonthlyWeekendOff: e.requiresMonthlyWeekendOff,
          toConfirm: e.toConfirm,
          balanceMinutes: balanceOf.get(e.id) ?? 0,
        }))}
      />
    </>
  );
}
