import { describe, expect, it } from "vitest";
import { replanLocks, replanStart } from "./replan";
import type { Assignment } from "./types";

describe("replanStart", () => {
  it("is tomorrow when tomorrow is in the month", () => {
    expect(replanStart(2026, 11, "2026-11-02")).toBe("2026-11-03");
    expect(replanStart(2026, 11, "2026-10-31")).toBe("2026-11-01");
  });

  it("is null when tomorrow is in another month", () => {
    expect(replanStart(2026, 11, "2026-11-30")).toBeNull();
    expect(replanStart(2026, 12, "2026-11-02")).toBeNull();
    expect(replanStart(2026, 10, "2026-11-02")).toBeNull();
  });
});

describe("replanLocks", () => {
  const cell = (date: string, isLocked: boolean): Assignment => ({
    employeeId: "Yuki Tanaka",
    date,
    shiftTypeId: "A",
    dayCode: null,
    isLocked,
  });

  it("keeps future locks, drops past ones and those under an approved absence", () => {
    const cells = [
      cell("2026-11-10", true), // before the replan date
      cell("2026-11-16", true), // under the sick leave
      cell("2026-11-21", true), // kept
      cell("2026-11-22", false), // not locked
    ];
    const absences = [
      {
        employeeId: "Yuki Tanaka",
        dayCode: "SL",
        startDate: "2026-11-15",
        endDate: "2026-11-18",
      },
    ];
    expect(
      replanLocks(cells, absences, "2026-11-12").map((c) => c.date),
    ).toEqual(["2026-11-21"]);
  });
});
