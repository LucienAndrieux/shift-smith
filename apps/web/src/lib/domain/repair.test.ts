import { describe, expect, it } from "vitest";
import { november2026 } from "./__fixtures__/seed";
import { suggestFixes, violationIdentity } from "./repair";
import type { ScheduleInput } from "./types";
import { type Violation, validateSchedule } from "./validator";

const errorsOf = (input: ScheduleInput) =>
  validateSchedule(input).violations.filter((v) => v.severity === "error");

function find(input: ScheduleInput, predicate: (v: Violation) => boolean) {
  const v = errorsOf(input).find(predicate);
  if (!v) throw new Error("violation not found");
  return v;
}

const describeChange = (c: {
  employeeId: string;
  date: string;
  after: { shiftTypeId: string | null; dayCode: string | null };
}) => `${c.employeeId} ${c.date}=${c.after.shiftTypeId ?? c.after.dayCode}`;

const restaurantShortage = (v: Violation) =>
  v.code === "min_staff" &&
  v.sectionId === "restaurant" &&
  v.date === "2026-11-01";

describe("suggestFixes", () => {
  it("codes the birthday BD", () => {
    const input = november2026();
    const target = find(input, (v) => v.code === "birthday_off");
    const [best] = suggestFixes(input, violationIdentity(target));
    expect(best.changes.map(describeChange)).toEqual(
      expect.arrayContaining(["Yuki Tanaka 2026-11-14=BD"]),
    );
  });

  it("covers a staffing shortage with an eligible colleague", () => {
    const input = november2026();
    const target = find(input, restaurantShortage);
    const suggestions = suggestFixes(input, violationIdentity(target));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(
      suggestions[0].changes.some(
        (c) =>
          c.date === "2026-11-01" &&
          c.after.shiftTypeId?.startsWith("restaurant:"),
      ),
    ).toBe(true);
  });

  it("never introduces a new error and returns at most five suggestions", () => {
    const input = november2026();
    const before = new Set(errorsOf(input).map(violationIdentity));
    const target = find(input, restaurantShortage);
    const suggestions = suggestFixes(input, violationIdentity(target));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    for (const s of suggestions) {
      const changed = new Map(
        s.changes.map((c) => [`${c.employeeId}|${c.date}`, c.after]),
      );
      const after = errorsOf({
        ...input,
        assignments: input.assignments.map((a) => {
          const value = changed.get(`${a.employeeId}|${a.date}`);
          return value ? { ...a, ...value } : a;
        }),
      }).map(violationIdentity);
      expect(after).not.toContain(violationIdentity(target));
      for (const id of after) expect(before.has(id)).toBe(true);
    }
  });

  it("does not touch locked cells", () => {
    const input = november2026();
    for (const a of input.assignments) {
      if (
        a.employeeId === "Yuki Tanaka" &&
        a.date >= "2026-11-09" &&
        a.date <= "2026-11-15"
      ) {
        a.isLocked = true;
      }
    }
    const target = find(input, (v) => v.code === "birthday_off");
    expect(suggestFixes(input, violationIdentity(target))).toEqual([]);
  });

  it("returns nothing when no local edit can fix the error", () => {
    const input = november2026();
    // Every cell of Nov 1 is locked: nobody can be added to the restaurant.
    for (const a of input.assignments) {
      if (a.date === "2026-11-01") a.isLocked = true;
    }
    const target = find(input, restaurantShortage);
    expect(suggestFixes(input, violationIdentity(target))).toEqual([]);
  });

  it("returns nothing for an unknown violation", () => {
    expect(suggestFixes(november2026(), "nope")).toEqual([]);
  });
});
