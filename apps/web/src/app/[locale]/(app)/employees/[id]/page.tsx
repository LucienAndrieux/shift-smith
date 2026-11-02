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
import { dayCodeLabel } from "@/lib/i18n/labels";
import { getLocale, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import {
  getDayCodes,
  getEmployees,
  getSections,
  getShiftTypes,
} from "@/server/queries/reference";
import { requireUser } from "@/server/session";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).profile.title };
}

export default async function EmployeePage({
  params,
}: PageProps<"/[locale]/employees/[id]">) {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const p = t.profile;
  const e = t.employees;
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

  const canManage = user.role === "manager";
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
    .map((d) => ({
      value: d.code,
      label: `${d.code} — ${dayCodeLabel(t, d.code, d.label)}`,
    }));
  const rows = withRunningBalance(
    ledger.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  );
  const balance = rows.at(-1)?.balance ?? 0;

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/employees">
            <ArrowLeft /> {t.nav.employees}
          </Link>
        </Button>
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {employee.displayName}
            {employee.status === "inactive" && (
              <Badge variant="secondary">{e.inactive}</Badge>
            )}
            <ToConfirmBadge show={employee.toConfirm} />
          </span>
        }
        description={`${self?.sectionName ?? ""} · ${e.perWeek(employee.weeklyContractMinutes / 60)} · ${p.hourBankBalance(formatHoursMinutes(balance, true))}`}
        actions={
          canManage && (
            <EmployeeFormDialog employee={employee} sections={sectionOptions} />
          )
        }
      />

      <Tabs defaultValue="profile">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">{p.tabs.profile}</TabsTrigger>
            <TabsTrigger value="days-off">{p.tabs.daysOff}</TabsTrigger>
            <TabsTrigger value="shifts">{p.tabs.shifts}</TabsTrigger>
            <TabsTrigger value="relations">{p.tabs.relations}</TabsTrigger>
            <TabsTrigger value="absences">{p.tabs.absences}</TabsTrigger>
            <TabsTrigger value="unavailabilities">
              {p.tabs.unavailabilities}
            </TabsTrigger>
            <TabsTrigger value="hour-bank">{p.tabs.hourBank}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Item label={e.fullName}>{employee.fullName ?? "—"}</Item>
              <Item label={e.employeeNumber}>
                {employee.employeeNumber ?? "—"}
              </Item>
              <Item label={e.section}>{self?.sectionName}</Item>
              <Item label={p.weeklyContract}>
                {p.contractValue(
                  employee.weeklyContractMinutes / 60,
                  formatHours(
                    dailyContractMinutes(employee.weeklyContractMinutes),
                    2,
                  ),
                )}
                {employee.reducedSchedule && (
                  <Badge variant="outline" className="ml-2">
                    {e.reducedSchedule}
                  </Badge>
                )}
              </Item>
              <Item label={e.tlPerMonthLong}>{employee.monthlyTlDays}</Item>
              <Item label={p.weekendEachMonth}>
                {employee.requiresMonthlyWeekendOff ? p.required : p.no}
              </Item>
              <Item label={p.birthday}>
                {employee.birthdayMonth && employee.birthdayDay
                  ? `${employee.birthdayDay} ${MONTH_NAMES[locale][employee.birthdayMonth - 1]} (BD)`
                  : "—"}
              </Item>
              <Item label={e.hiredOn}>{employee.hiredOn ?? "—"}</Item>
              <Item label={e.leftOn}>{employee.leftOn ?? "—"}</Item>
              <div className="sm:col-span-2 lg:col-span-3">
                <Item label={e.notes}>
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
            title={e.fixedDaysOff}
            action={
              canManage && (
                <FixedDaysOffDialog
                  employeeId={id}
                  weekdays={fixed.map((f) => f.weekday)}
                />
              )
            }
          >
            {fixed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {p.noFixedDaysOff}
              </p>
            ) : (
              <div className="flex gap-3">
                {fixed.map((f) => (
                  <Badge
                    key={f.weekday}
                    variant="secondary"
                    className="text-sm"
                  >
                    {weekdayShort(f.weekday as Weekday, locale)}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="shifts">
          <Section
            title={p.eligibility}
            action={
              canManage && (
                <EligibilityDialog
                  employeeId={id}
                  shiftOptions={shiftOptions.filter(
                    (o) =>
                      !eligibility.some((el) => el.shiftTypeId === o.value),
                  )}
                />
              )
            }
          >
            <SimpleTable
              headers={[
                p.shift,
                p.hours,
                p.preference,
                p.weeklyLimit,
                p.note,
                "",
              ]}
              empty={p.noEligibility}
              rows={eligibility.map((el) => {
                const shift = shiftById.get(el.shiftTypeId);
                return {
                  key: el.shiftTypeId,
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
                        el.preference === "preferred" ? "default" : "secondary"
                      }
                    >
                      {t.enums.preference[el.preference]}
                    </Badge>,
                    el.exactPerWeek !== null
                      ? p.exactly(el.exactPerWeek)
                      : el.maxPerWeek !== null
                        ? p.max(el.maxPerWeek)
                        : "—",
                    el.note ?? "",
                    canManage ? (
                      <span key="a" className="flex justify-end gap-1">
                        <EligibilityDialog
                          employeeId={id}
                          shiftOptions={shiftOptions}
                          initial={el}
                        />
                        <DeleteEligibilityButton
                          employeeId={id}
                          shiftTypeId={el.shiftTypeId}
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
            title={p.tabs.relations}
            action={
              canManage && (
                <RelationDialog
                  employeeId={id}
                  others={employeeOptions.filter((o) => o.value !== id)}
                />
              )
            }
          >
            <SimpleTable
              headers={[p.rule, p.with, p.note, ""]}
              empty={p.noRelations}
              rows={relations.map((r) => {
                const other =
                  r.employeeAId === id ? r.employeeBId : r.employeeAId;
                return {
                  key: r.id,
                  cells: [
                    t.enums.relation[r.type],
                    <Link
                      key="o"
                      href={`/employees/${other}`}
                      className="hover:underline"
                    >
                      {nameOf.get(other)}
                    </Link>,
                    r.note ?? "",
                    canManage ? (
                      <DeleteRelationButton key="d" id={r.id} />
                    ) : null,
                  ],
                };
              })}
            />
          </Section>
        </TabsContent>

        <TabsContent value="absences">
          <Section
            title={p.tabs.absences}
            action={
              canManage && (
                <AbsenceDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus /> {p.addAbsence}
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
              headers={[
                t.absences.code,
                t.absences.from,
                t.absences.to,
                t.absences.status,
                t.absences.source,
                t.absences.note,
                "",
              ]}
              empty={p.noAbsences}
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
                  t.absences.statuses[a.status],
                  t.absences.sources[a.source],
                  a.note ?? "",
                  canManage ? (
                    <span key="a" className="flex justify-end gap-1">
                      <AbsenceDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t.absences.editLabel}
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
            title={p.tabs.unavailabilities}
            action={canManage && <UnavailabilityDialog employeeId={id} />}
          >
            <SimpleTable
              headers={[p.date, p.time, p.reason, t.absences.source, ""]}
              empty={p.noUnavailabilities}
              rows={unavailabilities.map((u) => ({
                key: u.id,
                cells: [
                  `${formatDayMonth(u.date, locale)} ${u.date.slice(0, 4)}`,
                  u.startMinute === null || u.endMinute === null
                    ? p.allDay
                    : `${formatTimeOfDay(u.startMinute)}–${formatTimeOfDay(u.endMinute)}`,
                  u.reason ?? "",
                  t.enums.unavailabilitySource[u.source],
                  canManage ? (
                    <DeleteUnavailabilityButton key="d" id={u.id} />
                  ) : null,
                ],
              }))}
            />
          </Section>
        </TabsContent>

        <TabsContent value="hour-bank">
          <Section
            title={p.ledgerTitle(formatHoursMinutes(balance, true))}
            action={
              canManage && (
                <HourBankAdjustmentDialog employeeId={id} today={today} />
              )
            }
          >
            <SimpleTable
              headers={[
                p.date,
                p.kind,
                p.minutes,
                p.balance,
                p.note,
                p.recorded,
              ]}
              empty={p.noEntries}
              rows={rows.map((entry) => ({
                key: entry.id,
                cells: [
                  entry.entryDate,
                  t.enums.hourBankKind[entry.kind],
                  <span
                    key="m"
                    className={cn(
                      "font-mono tabular-nums",
                      entry.minutes < 0 && "text-destructive",
                    )}
                  >
                    {formatHoursMinutes(entry.minutes, true)}
                  </span>,
                  <span
                    key="b"
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      entry.balance < 0 && "text-destructive",
                    )}
                  >
                    {formatHoursMinutes(entry.balance, true)}
                  </span>,
                  entry.note ?? "",
                  formatDateTime(entry.createdAt, locale),
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
