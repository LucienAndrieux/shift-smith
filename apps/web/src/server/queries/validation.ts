import "server-only";
import { and, asc, eq, gt, gte, or } from "drizzle-orm";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { validateSchedule } from "@/lib/domain/validator";
import { loadScheduleInput } from "@/server/month-context";
import { getScheduleView, type ScheduleView } from "@/server/queries/schedule";
import { canSeeSchedule } from "@/server/schedules";
import type { CurrentUser } from "@/server/session";

export interface ValidationTarget {
  view: ScheduleView;
  /** The displayed version is editable by this user (Fix buttons). */
  canEdit: boolean;
}

/**
 * The version of a month to validate: the requested one, otherwise the latest
 * draft for a manager, otherwise the published one.
 */
export async function getValidationTarget(
  user: CurrentUser,
  year: number,
  month: number,
  requested: number | null,
): Promise<ValidationTarget> {
  let view = await getScheduleView(year, month, requested, { user });
  if (requested === null) {
    const draft = view.versions
      .filter((v) => v.status === "draft" && user.role === "manager")
      .at(-1);
    if (draft && draft.version !== view.schedule?.version) {
      view = await getScheduleView(year, month, draft.version, { user });
    }
  }
  const schedule = view.schedule;
  const canEdit =
    schedule !== null &&
    schedule.status !== "archived" &&
    schedule.closedAt === null &&
    user.role === "manager";
  return { view, canEdit };
}

/** One validation target per month from `from` on that has a version the user sees. */
export async function getUpcomingValidationTargets(
  user: CurrentUser,
  from: { year: number; month: number },
): Promise<ValidationTarget[]> {
  const months = await db
    .selectDistinct({ year: schedules.year, month: schedules.month })
    .from(schedules)
    .where(
      or(
        gt(schedules.year, from.year),
        and(eq(schedules.year, from.year), gte(schedules.month, from.month)),
      ),
    )
    .orderBy(asc(schedules.year), asc(schedules.month));
  const targets = await Promise.all(
    months.map((m) => getValidationTarget(user, m.year, m.month, null)),
  );
  return targets.filter((t) => t.view.schedule !== null);
}

/**
 * Error and warning counts of the Validation page (current and upcoming months,
 * same version choice), computed without building the full schedule views.
 */
export async function getValidationCounts(
  user: CurrentUser,
  from: { year: number; month: number },
) {
  const rows = (
    await db
      .select()
      .from(schedules)
      .where(
        or(
          gt(schedules.year, from.year),
          and(eq(schedules.year, from.year), gte(schedules.month, from.month)),
        ),
      )
      .orderBy(asc(schedules.version))
  ).filter((s) => canSeeSchedule(user, s));
  const byMonth = new Map<string, typeof rows>();
  for (const s of rows) {
    const key = `${s.year}-${s.month}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), s]);
  }
  let errors = 0;
  let warnings = 0;
  for (const versions of byMonth.values()) {
    const editableDraft = versions
      .filter((v) => v.status === "draft" && user.role === "manager")
      .at(-1);
    const schedule =
      editableDraft ??
      versions.find((v) => v.status === "published") ??
      versions.at(-1);
    if (!schedule) continue;
    const { violations } = validateSchedule(
      await loadScheduleInput(db, schedule),
    );
    for (const v of violations) {
      if (v.severity === "error") errors++;
      else warnings++;
    }
  }
  return { errors, warnings };
}
