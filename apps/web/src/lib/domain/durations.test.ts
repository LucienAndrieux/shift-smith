import { describe, expect, it } from "vitest";
import { seedPlan } from "./__fixtures__/seed";
import { computeShiftDuration, validatePeriods } from "./durations";

function paid(section: string, code: string): number {
  const shift = seedPlan().shiftTypes.find(
    (s) => s.sectionCode === section && s.code === code,
  );
  if (!shift) throw new Error(`No shift ${section}/${code}`);
  return computeShiftDuration(shift.periods).paidMinutes;
}

describe("shift durations", () => {
  it("pays 8h for the day reception shifts and 7.5h for the night shift", () => {
    for (const code of ["A", "B", "C", "E"]) {
      expect(paid("reception", code)).toBe(480);
    }
    expect(paid("reception", "D")).toBe(450);
  });

  it("subtracts unpaid breaks inside periods", () => {
    expect(
      computeShiftDuration([
        { startMinute: 540, endMinute: 840, unpaidBreakMinutes: 30 },
      ]).paidMinutes,
    ).toBe(270);
  });

  it("matches the documented weekly patterns", () => {
    // Standard sections: 5 × 7.5h = 37.5h.
    for (const [section, code] of [
      ["housekeeping", "A"],
      ["housekeeping", "B"],
      ["storeroom", "A"],
      ["storeroom", "B"],
      ["maintenance", "A"],
    ]) {
      expect(5 * paid(section, code)).toBe(37.5 * 60);
    }
    // Reduced contract: 5 × housekeeping C = 30h.
    expect(5 * paid("housekeeping", "C")).toBe(30 * 60);
  });

  it("sums split restaurant and kitchen shifts", () => {
    expect(paid("restaurant", "A")).toBe(480);
    expect(paid("restaurant", "B")).toBe(450);
    expect(paid("kitchen", "A")).toBe(480);
  });

  it("reports first start and last end (B ends at 24:00)", () => {
    const b = seedPlan().shiftTypes.find(
      (s) => s.sectionCode === "reception" && s.code === "B",
    );
    expect(computeShiftDuration(b?.periods ?? [])).toMatchObject({
      firstStartMinute: 930,
      lastEndMinute: 1440,
    });
  });

  it("rejects invalid periods", () => {
    expect(validatePeriods([])).not.toHaveLength(0);
    expect(
      validatePeriods([
        { startMinute: 600, endMinute: 500, unpaidBreakMinutes: 0 },
      ]),
    ).not.toHaveLength(0);
    expect(
      validatePeriods([
        { startMinute: 480, endMinute: 720, unpaidBreakMinutes: 0 },
        { startMinute: 700, endMinute: 900, unpaidBreakMinutes: 0 },
      ]),
    ).toContain("Period 2: overlaps the previous period");
    expect(() =>
      computeShiftDuration([
        { startMinute: 0, endMinute: 60, unpaidBreakMinutes: 60 },
      ]),
    ).toThrow();
  });
});
