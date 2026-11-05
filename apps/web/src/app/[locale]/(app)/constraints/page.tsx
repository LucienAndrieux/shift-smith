import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { naturalLanguageConstraints, schedules, user } from "@/db/schema";
import { NO_DATE } from "@/lib/constraints/check";
import {
  describeOperation,
  parsedConstraintSchema,
} from "@/lib/constraints/operations";
import { formatDateTime } from "@/lib/dates";
import { formatMonth, WEEKDAY_SHORT } from "@/lib/domain/calendar";
import { getLocale, getT } from "@/lib/i18n/server";
import {
  getEmployees,
  getSections,
  getShiftTypes,
} from "@/server/queries/reference";
import { isManager, requireUser } from "@/server/session";
import { ConstraintsView } from "./constraints-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.constraints };
}

export default async function ConstraintsPage() {
  const me = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  await connection();
  const [rows, employees, sections, shifts, users] = await Promise.all([
    db
      .select()
      .from(naturalLanguageConstraints)
      // An employee sees the requests they sent; others see everything.
      .where(
        me.role === "employee"
          ? eq(naturalLanguageConstraints.createdBy, me.id)
          : undefined,
      )
      .orderBy(desc(naturalLanguageConstraints.createdAt))
      .limit(50),
    getEmployees(),
    getSections(),
    getShiftTypes(),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);
  const employeeName = new Map(employees.map((e) => [e.id, e.displayName]));
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const shiftName = new Map(
    shifts.map((s) => [s.id, `${s.sectionName} ${s.code}`]),
  );
  const userName = new Map(users.map((u) => [u.id, u.name]));

  // Forced shifts of a parsed constraint go where the manager picks, among the
  // editable versions of their month (one month only; else the latest draft).
  const forcedMonth = new Map<string, { year: number; month: number }>();
  for (const r of rows) {
    if (r.status !== "parsed") continue;
    const parsed = parsedConstraintSchema.safeParse(r.parsed);
    if (!parsed.success) continue;
    const months = new Set(
      parsed.data.operations
        .filter((op) => op.type === "shift_force")
        .map((op) => op.date.slice(0, 7)),
    );
    if (months.size !== 1) continue;
    const [key] = months;
    forcedMonth.set(r.id, {
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5)),
    });
  }
  const editable =
    forcedMonth.size === 0
      ? []
      : await db
          .select({
            id: schedules.id,
            year: schedules.year,
            month: schedules.month,
            version: schedules.version,
            status: schedules.status,
          })
          .from(schedules)
          .where(
            and(
              inArray(schedules.status, ["draft", "published"]),
              isNull(schedules.closedAt),
              or(
                ...[...forcedMonth.values()].map((m) =>
                  and(eq(schedules.year, m.year), eq(schedules.month, m.month)),
                ),
              ),
            ),
          )
          .orderBy(desc(schedules.version));
  const placementFor = (id: string) => {
    const target = forcedMonth.get(id);
    if (!target) return null;
    const versions = editable.filter(
      (s) => s.year === target.year && s.month === target.month,
    );
    return {
      label: formatMonth(target.year, target.month, locale),
      published:
        versions.find((s) => s.status === "published")?.version ?? null,
      versions: versions.map((s) => ({
        id: s.id,
        version: s.version,
        status: s.status as "draft" | "published",
      })),
    };
  };
  const names = {
    employee: (id: string) =>
      employeeName.get(id) ?? t.constraints.unknownEmployee(id.slice(0, 8)),
    section: (id: string) =>
      sectionName.get(id) ?? t.constraints.unknownSection,
    shift: (id: string) => shiftName.get(id) ?? t.constraints.unknownShift,
  };

  return (
    <>
      <PageHeader
        title={me.role === "employee" ? t.nav.myRequests : t.nav.constraints}
        description={
          me.role === "employee"
            ? t.constraints.employeeText
            : t.constraints.managerText
        }
      />
      <ConstraintsView
        canReview={isManager(me)}
        canSubmit={me.role !== "viewer"}
        asEmployee={me.role === "employee"}
        items={rows.map((r) => {
          const parsed = parsedConstraintSchema.safeParse(r.parsed);
          return {
            id: r.id,
            placement: placementFor(r.id),
            canRetry: me.role === "manager" || r.createdBy === me.id,
            rawText: r.rawText,
            status: r.status,
            model: r.model,
            parseError:
              r.parseError === NO_DATE ? t.constraints.noDate : r.parseError,
            createdAt: formatDateTime(r.createdAt, locale),
            createdBy: r.createdBy ? (userName.get(r.createdBy) ?? null) : null,
            reviewedBy: r.reviewedBy
              ? (userName.get(r.reviewedBy) ?? null)
              : null,
            reviewedAt: r.reviewedAt
              ? formatDateTime(r.reviewedAt, locale)
              : null,
            summary: parsed.success ? parsed.data.summary : null,
            operations: parsed.success
              ? parsed.data.operations.map((op) => ({
                  type: op.type,
                  text: describeOperation(
                    op,
                    names,
                    t.operations,
                    WEEKDAY_SHORT[locale],
                  ),
                }))
              : [],
          };
        })}
      />
    </>
  );
}
