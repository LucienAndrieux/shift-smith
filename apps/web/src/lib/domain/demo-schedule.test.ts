import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_PATH } from "./__fixtures__/seed";
import { generateDemoSchedule, shiftSeedFile } from "./demo-schedule";
import { buildSeedPlan, type SeedFile } from "./seed-mapping";

const raw = (): SeedFile => JSON.parse(readFileSync(SEED_PATH, "utf8"));

describe("rolling demo months", () => {
  it("moves the demo months and the absences to the target month", () => {
    const shifted = shiftSeedFile(raw(), { year: 2027, month: 3 });
    expect(shifted._meta.demo_months).toEqual([
      "2027-03",
      "2027-04",
      "2027-05",
    ]);
    expect(shifted.reference_schedule).toBeUndefined();
    // AL Nov 9–15, 2026 → Mar 9–15, 2027.
    expect(
      shifted.absences.find((a) => a.employee === "Henrik Lindqvist"),
    ).toMatchObject({ start: "2027-03-09", end: "2027-03-15" });
  });

  it("clamps days that do not exist in the new month", () => {
    // Dec 31 moved by one month stays Jan 31, by two months becomes Feb 28.
    const seed = raw();
    seed.absences = [
      {
        employee: "Noah Fischer",
        code: "AL",
        start: "2026-12-31",
        end: "2026-12-31",
      },
    ];
    const shifted = shiftSeedFile(seed, { year: 2026, month: 12 });
    expect(shifted.absences[0]).toMatchObject({
      start: "2027-01-31",
      end: "2027-01-31",
    });
    const feb = shiftSeedFile(seed, { year: 2027, month: 1 });
    expect(feb.absences[0].start).toBe("2027-02-28");
  });

  it("generates a schedule for another month with only a few errors", () => {
    const plan = buildSeedPlan(shiftSeedFile(raw(), { year: 2027, month: 2 }));
    const demo = generateDemoSchedule(plan);
    expect([demo.year, demo.month]).toEqual([2027, 2]);
    expect(Object.values(demo.grids).flatMap(Object.keys)).toHaveLength(28);
    for (const row of Object.values(demo.grids).flatMap(Object.values)) {
      expect(row).toHaveLength(28);
    }
    expect(
      demo.cleanViolations.filter((v) => v.severity === "error").length,
    ).toBeLessThanOrEqual(3);
    expect(demo.mistakes.length).toBeGreaterThanOrEqual(5);
  });
});
