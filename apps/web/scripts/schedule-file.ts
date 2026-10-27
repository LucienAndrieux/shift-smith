import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq, ne } from "drizzle-orm";
import { closeDb, db } from "@/db";
import {
  employees,
  scheduleAssignments,
  schedules,
  sections,
  shiftTypes,
} from "@/db/schema";
import { audit } from "@/server/audit";
import { nextScheduleVersion } from "@/server/schedule-versions";
import { findRepoRoot } from "./load-env";

/**
 * Copies a month's schedule between databases (e.g. development → production)
 * through a JSON file keyed on natural keys (employee name, section + shift code).
 *
 *   pnpm db:export-schedule 2026 12 [--version 3]   → docs/schedules/2026-12.json
 *   pnpm db:import-schedule docs/schedules/2026-12.json [--publish]
 *
 * Export takes the published version (or --version). Import creates a new version
 * (draft, or published with --publish, archiving the current one) and does
 * nothing when the month's published version already holds the same cells.
 */

interface CellFile {
  employee: string;
  date: string;
  section?: string;
  shift?: string;
  dayCode?: string;
  locked?: boolean;
  note?: string;
}

interface ScheduleFile {
  year: number;
  month: number;
  title: string | null;
  exportedFrom: { version: number; status: string };
  assignments: CellFile[];
}

const cellKey = (c: CellFile) =>
  [
    c.employee,
    c.date,
    c.section ?? "",
    c.shift ?? "",
    c.dayCode ?? "",
    c.locked ? "1" : "",
    c.note ?? "",
  ].join("|");

/** A version's cells in file form, sorted. */
async function readCells(scheduleId: string): Promise<CellFile[]> {
  const rows = await db
    .select({
      employee: employees.displayName,
      date: scheduleAssignments.date,
      section: sections.code,
      shift: shiftTypes.code,
      dayCode: scheduleAssignments.dayCode,
      locked: scheduleAssignments.isLocked,
      note: scheduleAssignments.note,
    })
    .from(scheduleAssignments)
    .innerJoin(employees, eq(employees.id, scheduleAssignments.employeeId))
    .leftJoin(shiftTypes, eq(shiftTypes.id, scheduleAssignments.shiftTypeId))
    .leftJoin(sections, eq(sections.id, shiftTypes.sectionId))
    .where(eq(scheduleAssignments.scheduleId, scheduleId));
  return rows
    .map((r) => ({
      employee: r.employee,
      date: r.date,
      ...(r.shift ? { section: r.section ?? "", shift: r.shift } : {}),
      ...(r.dayCode ? { dayCode: r.dayCode } : {}),
      ...(r.locked ? { locked: true } : {}),
      ...(r.note ? { note: r.note } : {}),
    }))
    .sort((a, b) =>
      a.employee === b.employee
        ? a.date.localeCompare(b.date)
        : a.employee.localeCompare(b.employee),
    );
}

async function exportSchedule(year: number, month: number, version?: number) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.year, year),
        eq(schedules.month, month),
        version
          ? eq(schedules.version, version)
          : eq(schedules.status, "published"),
      ),
    );
  if (!schedule)
    throw new Error(
      `No ${version ? `version ${version}` : "published version"} for ${year}-${month}.`,
    );
  const file: ScheduleFile = {
    year,
    month,
    title: schedule.title,
    exportedFrom: { version: schedule.version, status: schedule.status },
    assignments: await readCells(schedule.id),
  };
  const dir = path.join(findRepoRoot(), "docs", "schedules");
  mkdirSync(dir, { recursive: true });
  const target = path.join(
    dir,
    `${year}-${String(month).padStart(2, "0")}.json`,
  );
  writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `Exported v${schedule.version} (${schedule.status}, ${file.assignments.length} cells) to ${path.relative(findRepoRoot(), target)}`,
  );
}

async function importSchedule(filePath: string, publish: boolean) {
  const file = JSON.parse(readFileSync(filePath, "utf8")) as ScheduleFile;
  const { year, month } = file;

  const employeeIds = new Map(
    (
      await db
        .select({ id: employees.id, name: employees.displayName })
        .from(employees)
    ).map((e) => [e.name, e.id]),
  );
  const shiftIds = new Map(
    (
      await db
        .select({
          id: shiftTypes.id,
          section: sections.code,
          code: shiftTypes.code,
        })
        .from(shiftTypes)
        .innerJoin(sections, eq(sections.id, shiftTypes.sectionId))
    ).map((s) => [`${s.section}/${s.code}`, s.id]),
  );
  const missing = new Set<string>();
  const values = file.assignments.map((c) => {
    const employeeId = employeeIds.get(c.employee);
    if (!employeeId) missing.add(`employee "${c.employee}"`);
    const shiftTypeId = c.shift
      ? shiftIds.get(`${c.section}/${c.shift}`)
      : null;
    if (c.shift && !shiftTypeId) missing.add(`shift ${c.section}/${c.shift}`);
    return {
      employeeId: employeeId ?? "",
      date: c.date,
      shiftTypeId: shiftTypeId ?? null,
      dayCode: c.dayCode ?? null,
      isLocked: c.locked ?? false,
      note: c.note ?? null,
    };
  });
  if (missing.size > 0)
    throw new Error(`Unknown in this database: ${[...missing].join(", ")}.`);

  const [published] = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.year, year),
        eq(schedules.month, month),
        eq(schedules.status, "published"),
      ),
    );
  if (published) {
    const current = (await readCells(published.id)).map(cellKey).sort();
    const incoming = file.assignments.map(cellKey).sort();
    if (current.join("\n") === incoming.join("\n")) {
      console.log(
        `The published version (v${published.version}) already matches the file: nothing to import.`,
      );
      return;
    }
    if (publish && published.closedAt)
      throw new Error(
        "The month's hour bank is closed: reopen it in the app before publishing.",
      );
  }

  const version = await nextScheduleVersion(year, month);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schedules)
      .values({
        year,
        month,
        version,
        status: "draft",
        source: "manual",
        title: file.title,
      })
      .returning({ id: schedules.id });
    if (values.length > 0)
      await tx
        .insert(scheduleAssignments)
        .values(values.map((v) => ({ ...v, scheduleId: created.id })));
    if (publish) {
      await tx
        .update(schedules)
        .set({ status: "archived" })
        .where(
          and(
            eq(schedules.year, year),
            eq(schedules.month, month),
            eq(schedules.status, "published"),
            ne(schedules.id, created.id),
          ),
        );
      await tx
        .update(schedules)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(schedules.id, created.id));
    }
    await audit(tx, {
      userId: null,
      action: "import",
      entity: "schedule",
      entityId: created.id,
      diff: {
        file: path.basename(filePath),
        version,
        cells: values.length,
        published: publish,
        archived: publish ? (published?.id ?? null) : null,
      },
    });
  });
  console.log(
    `Imported ${values.length} cells as v${version} (${publish ? `published${published ? `, v${published.version} archived` : ""}` : "draft"}).`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : (args[i + 1] ?? "");
  };
  if (command === "export") {
    const version = flag("--version");
    await exportSchedule(
      Number(args[0]),
      Number(args[1]),
      version ? Number(version) : undefined,
    );
  } else if (command === "import" && args[0]) {
    // pnpm runs package scripts from apps/web: also accept paths from the repo root.
    const file = existsSync(args[0])
      ? path.resolve(args[0])
      : path.join(findRepoRoot(), args[0]);
    await importSchedule(file, args.includes("--publish"));
  } else {
    console.error(
      "Usage: schedule-file.ts export <year> <month> [--version N]\n" +
        "       schedule-file.ts import <file.json> [--publish]",
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
