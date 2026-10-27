import { describe, expect, it } from "vitest";
import { easterSunday, publicHolidays } from "./holidays";

describe("public holidays", () => {
  it("computes Easter Sunday", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("lists the eleven French public holidays with the movable feasts", () => {
    const holidays = publicHolidays("FR", 2026);
    expect(holidays).toHaveLength(11);
    expect(holidays.map((h) => h.date)).toEqual([
      "2026-01-01",
      "2026-04-06",
      "2026-05-01",
      "2026-05-08",
      "2026-05-14",
      "2026-05-25",
      "2026-07-14",
      "2026-08-15",
      "2026-11-01",
      "2026-11-11",
      "2026-12-25",
    ]);
  });
});
