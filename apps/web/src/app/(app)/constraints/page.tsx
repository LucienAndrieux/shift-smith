import { desc, eq, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { naturalLanguageConstraints, user } from "@/db/schema";
import { monthsOutsideTarget } from "@/lib/constraints/check";
import {
  describeOperation,
  parsedConstraintSchema,
} from "@/lib/constraints/operations";
import { currentYearMonth, formatDateTime } from "@/lib/dates";
import { formatMonth } from "@/lib/domain/calendar";
import {
  getEmployees,
  getSections,
  getShiftTypes,
} from "@/server/queries/reference";
import { canPlan, requireApprovedUser } from "@/server/session";
import { ConstraintsView } from "./constraints-view";

export const metadata: Metadata = { title: "Constraints" };

export default async function ConstraintsPage() {
  const me = await requireApprovedUser();
  await connection();
  const [rows, employees, sections, shifts, users] = await Promise.all([
    db
      .select()
      .from(naturalLanguageConstraints)
      // Demo guests see their own constraints and the seeded examples.
      .where(
        me.isGuest
          ? or(
              eq(naturalLanguageConstraints.createdBy, me.id),
              isNull(naturalLanguageConstraints.createdBy),
            )
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
  const names = {
    employee: (id: string) =>
      employeeName.get(id) ?? `unknown employee (${id.slice(0, 8)})`,
    section: (id: string) => sectionName.get(id) ?? "unknown section",
    shift: (id: string) => shiftName.get(id) ?? "unknown shift",
  };

  const { year, month } = currentYearMonth();
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const defaultTarget = `${next.y}-${String(next.m).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title="Constraints"
        description="Write a constraint in plain language. It is parsed by the AI model into typed operations; nothing is applied until an admin approves it."
      />
      <ConstraintsView
        isAdmin={canPlan(me)}
        isDemo={me.role === "demo"}
        defaultTarget={defaultTarget}
        items={rows
          // An example the guest reviewed is replaced by their own copy.
          .filter(
            (r) =>
              r.createdBy !== null ||
              !rows.some(
                (o) => o.createdBy === me.id && o.rawText === r.rawText,
              ),
          )
          .map((r) => {
            const parsed = parsedConstraintSchema.safeParse(r.parsed);
            const target = `${r.targetYear}-${String(r.targetMonth).padStart(2, "0")}`;
            const outside = parsed.success
              ? monthsOutsideTarget(parsed.data, target).map((m) =>
                  formatMonth(Number(m.slice(0, 4)), Number(m.slice(5))),
                )
              : [];
            return {
              monthWarning:
                outside.length > 0
                  ? `The dates fall in ${outside.join(", ")}, not in the target month (${formatMonth(r.targetYear, r.targetMonth)}).`
                  : null,
              id: r.id,
              // Demo managers act on their own constraints and review the
              // examples through a private copy.
              canManage:
                me.role === "admin" ||
                r.createdBy === me.id ||
                (me.role === "demo" &&
                  r.createdBy === null &&
                  r.model === "example"),
              rawText: r.rawText,
              target: `${r.targetYear}-${String(r.targetMonth).padStart(2, "0")}`,
              status: r.status,
              model: r.model,
              parseError: r.parseError,
              createdAt: formatDateTime(r.createdAt),
              createdBy: r.createdBy
                ? (userName.get(r.createdBy) ?? null)
                : null,
              reviewedBy: r.reviewedBy
                ? (userName.get(r.reviewedBy) ?? null)
                : null,
              reviewedAt: r.reviewedAt ? formatDateTime(r.reviewedAt) : null,
              summary: parsed.success ? parsed.data.summary : null,
              operations: parsed.success
                ? parsed.data.operations.map((op) => ({
                    type: op.type,
                    text: describeOperation(op, names),
                  }))
                : [],
            };
          })}
      />
    </>
  );
}
