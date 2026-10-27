import { and, asc, desc, eq, or } from "drizzle-orm";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import {
  absences,
  employeeRelations,
  employeeShiftEligibility,
  employees,
  employeeUnavailabilities,
  hourBankEntries,
} from "@/db/schema";
import { formatDateTime, today as todayInAppZone } from "@/lib/dates";
import {
  formatDayMonth,
  MONTH_NAMES,
  type Weekday,
  weekdayShort,
} from "@/lib/domain/calendar";
import {
  dailyContractMinutes,
  withRunningBalance,
} from "@/lib/domain/hour-bank";
import {
  formatHours,
  formatHoursMinutes,
  formatTimeOfDay,
} from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import {
  getDayCodes,
  getEmployees,
  getSections,
  getShiftTypes,
} from "@/server/queries/reference";
import { requireApprovedUser } from "@/server/session";
import { AbsenceDialog } from "../../absences/absence-dialog";
import { DeleteAbsenceButton } from "../../absences/delete-absence-button";
import { EmployeeFormDialog } from "../employee-form";
import {
  DeleteEligibilityButton,
  DeleteRelationButton,
  DeleteUnavailabilityButton,
  EligibilityDialog,
  FixedDaysOffDialog,
  HourBankAdjustmentDialog,
  RelationDialog,
  UnavailabilityDialog,
} from "./editors";

export const metadata: Metadata = { title: "Employee" };

const RELATION_LABELS = {
  same_days_off: "Same days off",
  different_weekend_off: "Different weekend off",
} as const;

export default async function EmployeePage({
  params,
}: PageProps<"/employees/[id]">) {
  const user = await requireApprovedUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));
  if (!employee) notFound();
  await connection();

  const [
    sections,
    shiftTypes,
    allEmployees,
    dayCodes,
    eligibility,
    relations,
    absenceRows,
    unavailabilities,
    ledger,
  ] = await Promise.all([
    getSections(),
    getShiftTypes(),
    getEmployees(),
    getDayCodes(),
    db
      .select()
      .from(employeeShiftEligibility)
      .where(eq(employeeShiftEligibility.employeeId, id)),
    db
      .select()
      .from(employeeRelations)
      .where(
        or(
          eq(employeeRelations.employeeAId, id),
          eq(employeeRelations.employeeBId, id),
        ),
      ),
    db
      .select()
      .from(absences)
      .where(eq(absences.employeeId, id))
      .orderBy(desc(absences.startDate)),
    db
      .select()
      .from(employeeUnavailabilities)
      .where(eq(employeeUnavailabilities.employeeId, id))
      .orderBy(desc(employeeUnavailabilities.date)),
    db
      .select()
      .from(hourBankEntries)
      .where(and(eq(hourBankEntries.employeeId, id)))
      .orderBy(asc(hourBankEntries.entryDate)),
  ]);

  const isAdmin = user.role === "admin";
  const today = todayInAppZone();
  const self = allEmployees.find((e) => e.id === id);
  const fixed = self?.fixedDaysOff ?? [];
  const nameOf = new Map(allEmployees.map((e) => [e.id, e.displayName]));
  const shiftById = new Map(shiftTypes.map((s) => [s.id, s]));
  const shiftOptions = shiftTypes.map((s) => ({
    value: s.id,
    label: `${s.sectionName} — ${s.label}`,
  }));
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }));
  const employeeOptions = allEmployees.map((e) => ({
    value: e.id,
    label: e.displayName,
  }));
  const absenceCodes = dayCodes
    .filter((d) => d.kind === "absence")
    .map((d) => ({ value: d.code, label: `${d.code} — ${d.label}` }));
  const rows = withRunningBalance(
    ledger.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  );
  const balance = rows.at(-1)?.balance ?? 0;

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/employees">
            <ArrowLeft /> Employees
          </Link>
        </Button>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {employee.displayName}
            {employee.status === "inactive" && (
              <Badge variant="secondary">Inactive</Badge>
            )}
            <ToConfirmBadge show={employee.toConfirm} />
          </span>
        }
        description={`${self?.sectionName ?? ""} · ${employee.weeklyContractMinutes / 60}h/week · hour bank ${formatHoursMinutes(balance, true)}`}
        actions={
          isAdmin && (
            <EmployeeFormDialog employee={employee} sections={sectionOptions} />
          )
        }
      />

      <Tabs defaultValue="profile">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="days-off">Fixed days off</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
            <TabsTrigger value="relations">Relations</TabsTrigger>
            <TabsTrigger value="absences">Absences</TabsTrigger>
            <TabsTrigger value="unavailabilities">Unavailabilities</TabsTrigger>
            <TabsTrigger value="hour-bank">Hour bank</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="Full name">{employee.fullName ?? "—"}</Item>
              <Item label="Employee number">
                {employee.employeeNumber ?? "—"}
              </Item>
              <Item label="Section">{self?.sectionName}</Item>
              <Item label="Weekly contract">
                {employee.weeklyContractMinutes / 60}h (daily{" "}
                {formatHours(
                  dailyContractMinutes(employee.weeklyContractMinutes),
                  2,
                )}
                )
                {employee.reducedSchedule && (
                  <Badge variant="outline" className="ml-2">
                    Reduced schedule
                  </Badge>
                )}
              </Item>
              <Item label="Time off in lieu per month">
                {employee.monthlyTlDays}
              </Item>
              <Item label="Full weekend off each month">
                {employee.requiresMonthlyWeekendOff ? "Required" : "No"}
              </Item>
              <Item label="Birthday">
                {employee.birthdayMonth && employee.birthdayDay
                  ? `${employee.birthdayDay} ${MONTH_NAMES[employee.birthdayMonth - 1]} (BD)`
                  : "—"}
              </Item>
              <Item label="Hired on">{employee.hiredOn ?? "—"}</Item>
              <Item label="Left on">{employee.leftOn ?? "—"}</Item>
              <div className="sm:col-span-2 lg:col-span-3">
                <Item label="Notes">
                  <span className="whitespace-pre-line">
                    {employee.notes ?? "—"}
                  </span>
                </Item>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="days-off">
          <Section
            title="Fixed days off"
            action={
              isAdmin && (
                <FixedDaysOffDialog
                  employeeId={id}
                  weekdays={fixed.map((f) => f.weekday)}
                />
              )
            }
          >
            {fixed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fixed days off recorded.
              </p>
            ) : (
              <div className="flex gap-3">
                {fixed.map((f) => (
                  <Badge
                    key={f.weekday}
                    variant="secondary"
                    className="text-sm"
                  >
                    {weekdayShort(f.weekday as Weekday)}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="shifts">
          <Section
            title="Shift eligibility"
            action={
              isAdmin && (
                <EligibilityDialog
                  employeeId={id}
                  shiftOptions={shiftOptions.filter(
                    (o) => !eligibility.some((e) => e.shiftTypeId === o.value),
                  )}
                />
              )
            }
          >
            <SimpleTable
              headers={[
                "Shift",
                "Hours",
                "Preference",
                "Weekly limit",
                "Note",
                "",
              ]}
              empty="Not eligible for any shift."
              rows={eligibility.map((e) => {
                const shift = shiftById.get(e.shiftTypeId);
                return {
                  key: e.shiftTypeId,
                  cells: [
                    <span key="s" className="flex items-center gap-2">
                      <ShiftSwatch color={shift?.color} />
                      {shift?.sectionName} {shift?.code}
                      <ToConfirmBadge show={shift?.toConfirm} />
                    </span>,
                    shift ? formatHours(shift.paidMinutes) : "—",
                    <Badge
                      key="p"
                      variant={
                        e.preference === "preferred" ? "default" : "secondary"
                      }
                    >
                      {e.preference}
                    </Badge>,
                    e.exactPerWeek !== null
                      ? `exactly ${e.exactPerWeek}`
                      : e.maxPerWeek !== null
                        ? `max ${e.maxPerWeek}`
                        : "—",
                    e.note ?? "",
                    isAdmin ? (
                      <span key="a" className="flex justify-end gap-1">
                        <EligibilityDialog
                          employeeId={id}
                          shiftOptions={shiftOptions}
                          initial={e}
                        />
                        <DeleteEligibilityButton
                          employeeId={id}
                          shiftTypeId={e.shiftTypeId}
                          label={`${shift?.sectionName} ${shift?.code}`}
                        />
                      </span>
                    ) : null,
                  ],
                };
              })}
            />
          </Section>
        </TabsContent>

        <TabsContent value="relations">
          <Section
            title="Relations"
            action={
              isAdmin && (
                <RelationDialog
                  employeeId={id}
                  others={employeeOptions.filter((o) => o.value !== id)}
                />
              )
            }
          >
            <SimpleTable
              headers={["Rule", "With", "Note", ""]}
              empty="No relations."
              rows={relations.map((r) => {
                const other =
                  r.employeeAId === id ? r.employeeBId : r.employeeAId;
                return {
                  key: r.id,
                  cells: [
                    RELATION_LABELS[r.type],
                    <Link
                      key="o"
                      href={`/employees/${other}`}
                      className="hover:underline"
                    >
                      {nameOf.get(other)}
                    </Link>,
                    r.note ?? "",
                    isAdmin ? <DeleteRelationButton key="d" id={r.id} /> : null,
                  ],
                };
              })}
            />
          </Section>
        </TabsContent>

        <TabsContent value="absences">
          <Section
            title="Absences"
            action={
              isAdmin && (
                <AbsenceDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus /> Add absence
                    </Button>
                  }
                  employees={employeeOptions}
                  codes={absenceCodes}
                  defaultEmployeeId={id}
                />
              )
            }
          >
            <SimpleTable
              headers={["Code", "From", "To", "Status", "Source", "Note", ""]}
              empty="No absences."
              rows={absenceRows.map((a) => ({
                key: a.id,
                className:
                  a.status === "cancelled"
                    ? "opacity-50 line-through"
                    : undefined,
                cells: [
                  <Badge key="c" variant="outline">
                    {a.dayCode}
                  </Badge>,
                  a.startDate,
                  <span key="e" className="flex items-center gap-2">
                    {a.endDate}
                    <ToConfirmBadge show={a.endToConfirm} />
                  </span>,
                  a.status,
                  a.source,
                  a.note ?? "",
                  isAdmin ? (
                    <span key="a" className="flex justify-end gap-1">
                      <AbsenceDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit"
                          >
                            <Pencil />
                          </Button>
                        }
                        absence={a}
                        employees={employeeOptions}
                        codes={absenceCodes}
                        defaultEmployeeId={id}
                      />
                      <DeleteAbsenceButton id={a.id} />
                    </span>
                  ) : null,
                ],
              }))}
            />
          </Section>
        </TabsContent>

        <TabsContent value="unavailabilities">
          <Section
            title="Unavailabilities"
            action={isAdmin && <UnavailabilityDialog employeeId={id} />}
          >
            <SimpleTable
              headers={["Date", "Time", "Reason", "Source", ""]}
              empty="No unavailabilities."
              rows={unavailabilities.map((u) => ({
                key: u.id,
                cells: [
                  `${formatDayMonth(u.date)} ${u.date.slice(0, 4)}`,
                  u.startMinute === null || u.endMinute === null
                    ? "All day"
                    : `${formatTimeOfDay(u.startMinute)}–${formatTimeOfDay(u.endMinute)}`,
                  u.reason ?? "",
                  u.source,
                  isAdmin ? (
                    <DeleteUnavailabilityButton key="d" id={u.id} />
                  ) : null,
                ],
              }))}
            />
          </Section>
        </TabsContent>

        <TabsContent value="hour-bank">
          <Section
            title={`Hour bank ledger — balance ${formatHoursMinutes(balance, true)}`}
            action={
              isAdmin && (
                <HourBankAdjustmentDialog employeeId={id} today={today} />
              )
            }
          >
            <SimpleTable
              headers={[
                "Date",
                "Kind",
                "Minutes",
                "Balance",
                "Note",
                "Recorded",
              ]}
              empty="No entries."
              rows={rows.map((e) => ({
                key: e.id,
                cells: [
                  e.entryDate,
                  e.kind.replaceAll("_", " "),
                  <span
                    key="m"
                    className={cn(
                      "font-mono tabular-nums",
                      e.minutes < 0 && "text-destructive",
                    )}
                  >
                    {formatHoursMinutes(e.minutes, true)}
                  </span>,
                  <span
                    key="b"
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      e.balance < 0 && "text-destructive",
                    )}
                  >
                    {formatHoursMinutes(e.balance, true)}
                  </span>,
                  e.note ?? "",
                  formatDateTime(e.createdAt),
                ],
              }))}
            />
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ShiftSwatch({ color }: { color?: string }) {
  return (
    <span
      className="inline-block size-3 rounded-sm border"
      style={{ backgroundColor: color ?? "transparent" }}
    />
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: { key: string; cells: ReactNode[]; className?: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static headers
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className={row.className}>
              {row.cells.map((cell, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed column order
                <TableCell key={i}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
