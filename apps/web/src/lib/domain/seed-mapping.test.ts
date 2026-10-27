import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_PATH, seedPlan } from "./__fixtures__/seed";
import { buildSeedPlan, openingBalanceDate } from "./seed-mapping";

function seedPlanRaw() {
  return JSON.parse(readFileSync(SEED_PATH, "utf8"));
}

describe("seed mapping", () => {
  const plan = seedPlan();

  it("imports 28 employees in 6 sections", () => {
    expect(plan.employees).toHaveLength(28);
    expect(plan.sections.map((s) => s.code)).toEqual([
      "reception",
      "housekeeping",
      "restaurant",
      "kitchen",
      "storeroom",
      "maintenance",
    ]);
  });

  it("maps the fixed days off to weekdays", () => {
    const amara = plan.employees.find((e) => e.name === "Amara Okafor");
    expect(amara?.fixedDaysOff).toEqual([{ weekday: 1 }, { weekday: 2 }]);
  });

  it("maps contracts, birthdays and shift limits", () => {
    const olga = plan.employees.find((e) => e.name === "Olga Petrenko");
    expect(olga).toMatchObject({
      weeklyContractMinutes: 1800,
      reducedSchedule: true,
    });
    const hamid = plan.employees.find((e) => e.name === "Hamid Rahimi");
    expect(hamid?.eligibility.map((e) => e.exactPerWeek)).toEqual([null, 2]);

    const yuki = plan.employees.find((e) => e.name === "Yuki Tanaka");
    expect(yuki).toMatchObject({ birthdayMonth: 11, birthdayDay: 14 });

    const henrik = plan.employees.find((e) => e.name === "Henrik Lindqvist");
    expect(henrik?.eligibility).toEqual([
      expect.objectContaining({ shiftCode: "E", preference: "preferred" }),
      expect.objectContaining({ shiftCode: "A", maxPerWeek: 2 }),
    ]);
  });

  it("keeps to_confirm flags on open-ended sick leave", () => {
    expect(
      plan.absences.filter((a) => a.endToConfirm).map((a) => a.employee),
    ).toEqual(["Nadia Belkacem", "Aisha Bello"]);
  });

  it("generates readable shift labels", () => {
    const d = plan.shiftTypes.find(
      (s) => s.sectionCode === "reception" && s.code === "D",
    );
    expect(d?.label).toBe("D · 00:00–07:30");
  });

  it("generates public holidays for the demo years", () => {
    const dates = plan.holidays.map((h) => h.date);
    expect(dates).toHaveLength(22);
    expect(dates).toEqual(
      expect.arrayContaining(["2026-11-11", "2026-12-25", "2027-01-01"]),
    );
  });

  it("dates opening balances the day before the first demo month", () => {
    expect(openingBalanceDate(plan)).toBe("2026-10-31");
    expect(
      plan.openingBalances.find((b) => b.employee === "Kwame Mensah")?.minutes,
    ).toBe(480);
  });

  it("imports the generated November grid for every employee", () => {
    const { year, month, cells } = plan.referenceSchedule;
    expect([year, month]).toEqual([2026, 11]);
    expect(new Set(cells.map((c) => c.employee)).size).toBe(28);
    expect(cells).toHaveLength(28 * 30);
    expect(
      cells.find(
        (c) => c.employee === "Amara Okafor" && c.date === "2026-11-04",
      ),
    ).toMatchObject({
      shiftCode: "D",
      dayCode: null,
      sectionCode: "reception",
    });
  });

  it("rejects inconsistent data", () => {
    const raw = structuredClone(seedPlanRaw());
    raw.absences.push({
      employee: "Nobody",
      code: "AL",
      start: "2026-11-01",
      end: "2026-11-02",
    });
    expect(() => buildSeedPlan(raw)).toThrow(/unknown employee "Nobody"/);
  });
});
