import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInMonth,
  diffDays,
  isoWeekKey,
  isoWeeksOfMonth,
  weekday,
} from "./calendar";

describe("calendar", () => {
  it("knows that 2026-10-01 is a Thursday", () => {
    expect(weekday("2026-10-01")).toBe(4);
    expect(weekday("2026-10-04")).toBe(7);
    expect(weekday("2026-10-05")).toBe(1);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(diffDays("2026-10-01", "2026-11-01")).toBe(31);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("lists the ISO weeks overlapping October 2026", () => {
    const weeks = isoWeeksOfMonth(2026, 10);
    expect(weeks.map((w) => w.key)).toEqual([
      "2026-W40",
      "2026-W41",
      "2026-W42",
      "2026-W43",
      "2026-W44",
    ]);
    expect(weeks[0].dates[0]).toBe("2026-09-28");
    expect(weeks[4].dates[6]).toBe("2026-11-01");
  });

  it("uses ISO week-numbering years", () => {
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
  });
});
