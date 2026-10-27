import { readFileSync } from "node:fs";
import path from "node:path";
import { closeDb, db } from "@/db";
import { formatMonth } from "@/lib/domain/calendar";
import { buildSeedPlan } from "@/lib/domain/seed-mapping";
import { formatHoursMinutes } from "@/lib/domain/time";
import { summarizeViolations, validateSchedule } from "@/lib/domain/validator";
import { loadScheduleInput } from "@/server/month-context";
import { seedDatabase } from "@/server/seed";
import { findRepoRoot } from "./load-env";

/** Idempotent import of docs/seed-data.json (see src/server/seed.ts), then a report. */

async function report(schedule: {
  id: string;
  year: number;
  month: number;
  version: number;
  status: string;
}) {
  const input = await loadScheduleInput(db, schedule);
  const result = validateSchedule(input);
  const name = new Map(input.employees.map((e) => [e.id, e.displayName]));

  console.log(
    `\nValidator report — ${formatMonth(schedule.year, schedule.month)} (v${schedule.version}, ${schedule.status})`,
  );
  console.log(
    "Violations are expected: the demo schedule contains a few deliberate mistakes.\n",
  );
  console.table(
    summarizeViolations(result.violations).map((s) => ({
      rule: s.label,
      errors: s.error,
      warnings: s.warning,
    })),
  );

  const errors = result.violations.filter(
    (v) => v.severity === "error" && v.code !== "min_staff",
  );
  if (errors.length > 0) {
    console.log("Errors (excluding minimum staffing):");
    for (const v of errors) console.log(`  • [${v.code}] ${v.message}`);
  }
  const staffing = result.violations.filter((v) => v.code === "min_staff");
  if (staffing.length > 0) {
    const bySection = new Map<string, number>();
    for (const v of staffing) {
      const section =
        input.sections.find((s) => s.id === v.sectionId)?.name ?? "?";
      bySection.set(section, (bySection.get(section) ?? 0) + 1);
    }
    console.log(
      `Minimum staffing shortfalls: ${[...bySection].map(([s, n]) => `${s} ${n}`).join(", ")}`,
    );
  }

  console.log("\nHour bank preview (month delta):");
  console.table(
    result.employeeTotals.map((t) => ({
      employee: name.get(t.employeeId),
      worked: formatHoursMinutes(t.month.workedMinutes),
      credited: formatHoursMinutes(t.month.creditedMinutes),
      expected: formatHoursMinutes(t.month.expectedMinutes),
      delta: formatHoursMinutes(t.month.deltaMinutes, true),
      unassigned: t.month.unassignedDays || "",
    })),
  );
}

async function main() {
  const seedPath =
    process.env.SEED_FILE ??
    path.join(findRepoRoot(), "docs", "seed-data.json");
  const plan = buildSeedPlan(JSON.parse(readFileSync(seedPath, "utf8")));
  const { schedule, counts } = await seedDatabase(plan);

  console.log("Seed complete. Rows inserted:");
  if (counts.size === 0)
    console.log("  (nothing new — database already seeded)");
  for (const [table, n] of counts) console.log(`  ${table}: ${n}`);

  if (schedule) await report(schedule);
  else
    console.log(
      "\nNo reference schedule in the seed file: run `pnpm db:generate-demo` first.",
    );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
