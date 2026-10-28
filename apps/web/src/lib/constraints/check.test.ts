import { describe, expect, it } from "vitest";
import { checkParsedConstraint, monthsOutsideTarget } from "./check";
import { parsedConstraintSchema } from "./operations";

const refs = {
  employeeIds: new Set(["priya", "jonas"]),
  shiftTypeIds: new Set(["kitchen-a"]),
  sectionIds: new Set(["kitchen"]),
  absenceCodes: new Set(["PH", "AL", "SL", "BD", "TL", "TR", "OL", "UL"]),
};

describe("constraint operations", () => {
  it("accepts a valid parse (both examples from the constraints screen)", () => {
    const parsed = parsedConstraintSchema.parse({
      summary:
        "Priya cannot work mornings in the week of Dec 7; Jonas is on sick leave until Dec 18.",
      operations: [
        {
          type: "unavailability",
          employeeId: "priya",
          startDate: "2026-12-07",
          endDate: "2026-12-13",
          startTime: "00:00",
          endTime: "13:00",
          reason: "Mornings",
        },
        {
          type: "absence",
          employeeId: "jonas",
          dayCode: "SL",
          startDate: "2026-12-01",
          endDate: "2026-12-18",
          note: null,
        },
      ],
    });
    expect(checkParsedConstraint(parsed, refs)).toEqual([]);
  });

  it("reports unknown ids, bad dates and reversed ranges", () => {
    const parsed = parsedConstraintSchema.parse({
      summary: "x",
      operations: [
        {
          type: "shift_ban",
          employeeId: "ghost",
          shiftTypeId: "kitchen-z",
          startDate: "2026-11-31",
          endDate: "2026-11-01",
          reason: null,
        },
        {
          type: "absence",
          employeeId: "priya",
          dayCode: "OF",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
          note: null,
        },
        {
          type: "staffing_override",
          sectionId: "kitchen",
          shiftTypeId: null,
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          minStaff: 3,
          maxStaff: 2,
          reason: "Trade fair",
        },
      ],
    });
    const problems = checkParsedConstraint(parsed, refs);
    expect(problems).toEqual(
      expect.arrayContaining([
        "Operation 1 (shift_ban): unknown employee",
        "Operation 1 (shift_ban): unknown shift",
        'Operation 1 (shift_ban): invalid date "2026-11-31"',
        "Operation 1 (shift_ban): the end date is before the start date",
        'Operation 2 (absence): "OF" is not an absence code',
        "Operation 3 (staffing_override): maximum below minimum",
      ]),
    );
  });

  it("lists the months of the dates outside the target month", () => {
    const parsed = parsedConstraintSchema.parse({
      summary: "x",
      operations: [
        {
          type: "shift_force",
          employeeId: "priya",
          shiftTypeId: "kitchen-a",
          date: "2026-12-07",
          reason: null,
        },
        {
          type: "absence",
          employeeId: "jonas",
          dayCode: "SL",
          startDate: "2026-11-30",
          endDate: "2027-01-02",
          note: null,
        },
      ],
    });
    expect(monthsOutsideTarget(parsed, "2026-11")).toEqual([
      "2026-12",
      "2027-01",
    ]);
    expect(monthsOutsideTarget(parsed, "2026-12")).toEqual([
      "2026-11",
      "2027-01",
    ]);
  });
});
