import { describe, expect, it } from "vitest";
import { november2026 } from "./__fixtures__/seed";
import { addDays } from "./calendar";
import type { ScheduleInput } from "./types";
import {
  summarizeViolations,
  type Violation,
  validateSchedule,
} from "./validator";

const codes = (violations: Violation[]) => violations.map((v) => v.code);

/** One reception employee (Leila Haddad) with a grid starting on Sun 1 Nov 2026. */
function single(
  grid: string[],
  patch: (input: ScheduleInput) => void = () => {},
): ScheduleInput {
  const base = november2026();
  const input: ScheduleInput = {
    ...base,
    employees: base.employees.filter((e) => e.id === EMPLOYEE),
    relations: [],
    absences: [],
    staffingRequirements: [],
    assignments: [],
  };
  const employee = input.employees[0];
  employee.birthdayMonth = null;
  employee.requiresMonthlyWeekendOff = false;
  employee.monthlyTlDays = 1;
  employee.fixedDaysOff = [{ weekday: 6 }, { weekday: 7 }];
  grid.forEach((code, i) => {
    const isDay = input.dayCodes.some((d) => d.code === code);
    input.assignments.push({
      employeeId: employee.id,
      date: addDays("2026-11-01", i),
      shiftTypeId: isDay ? null : `reception:${code}`,
      dayCode: isDay ? code : null,
      isLocked: false,
    });
  });
  patch(input);
  return input;
}

const EMPLOYEE = "Leila Haddad";

// Sun 1 → Mon 30. A clean month: 5 shifts + 2 OF each ISO week, 1 TL.
// biome-ignore format: one ISO week per line
const CLEAN = [
  "OF",
  "A", "A", "A", "A", "A", "OF", "OF",
  "A", "A", "A", "A", "A", "OF", "OF",
  "A", "A", "A", "A", "TL", "OF", "OF",
  "A", "A", "A", "A", "A", "OF", "OF",
  "A",
];

describe("validator — synthetic cases", () => {
  it("accepts a clean month", () => {
    const { violations } = validateSchedule(single(CLEAN));
    expect(violations.filter((v) => v.severity === "error")).toEqual([]);
  });

  it("detects the B → D rest problem across midnight (0h rest)", () => {
    const grid = [...CLEAN];
    grid[1] = "B"; // Mon 2 ends 24:00
    grid[2] = "D"; // Tue 3 starts 00:00
    const { violations } = validateSchedule(single(grid));
    const rest = violations.filter(
      (v) => v.code === "min_rest_between_shifts_hours",
    );
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({ date: "2026-11-03", severity: "error" });
    expect(rest[0].message).toContain("only 0h rest");
  });

  it("accepts 11h15 of rest (B until 24:00, then C at 11:15)", () => {
    const grid = [...CLEAN];
    grid[1] = "B";
    grid[2] = "C";
    expect(codes(validateSchedule(single(grid)).violations)).not.toContain(
      "min_rest_between_shifts_hours",
    );
  });

  it("uses the previous month tail for rest and consecutive days", () => {
    const input = single(["D", ...CLEAN.slice(1)], (i) => {
      i.previousAssignments = Array.from({ length: 6 }, (_, k) => ({
        employeeId: EMPLOYEE,
        date: addDays("2026-10-26", k),
        shiftTypeId: "reception:B",
        dayCode: null,
        isLocked: false,
      }));
    });
    const found = codes(validateSchedule(input).violations);
    expect(found).toContain("min_rest_between_shifts_hours"); // Oct 31 B → Nov 1 D
    expect(found).toContain("max_consecutive_work_days"); // Oct 26 → Nov 1 = 7 days
  });

  it("flags more than 6 consecutive working days", () => {
    const grid = [...CLEAN];
    grid[6] = "A"; // Mon 2 … Sat 7 = 6 days: allowed
    expect(codes(validateSchedule(single(grid)).violations)).not.toContain(
      "max_consecutive_work_days",
    );
    grid[7] = "A"; // Sun 8 → 7 in a row and no rest day in W45
    const found = codes(validateSchedule(single(grid)).violations);
    expect(found).toContain("max_consecutive_work_days");
    expect(found).toContain("two_rest_days_per_week");
  });

  it("checks eligibility and per-week maximums", () => {
    const input = single(CLEAN, (i) => {
      i.employees[0].eligibility = [
        {
          shiftTypeId: "reception:A",
          preference: "normal",
          maxPerWeek: 3,
          exactPerWeek: null,
        },
      ];
      i.assignments[1].shiftTypeId = "reception:E";
    });
    const found = codes(validateSchedule(input).violations);
    expect(found).toContain("shift_eligibility");
    expect(found).toContain("shift_max_per_week");
  });

  it("checks exact per-week counts only on complete weeks without absences", () => {
    const input = single(CLEAN, (i) => {
      i.employees[0].eligibility = [
        {
          shiftTypeId: "reception:A",
          preference: "normal",
          maxPerWeek: null,
          exactPerWeek: 5,
        },
      ];
    });
    // W47 has a TL (4 × A): exempt. W44 and W49 are partial: exempt.
    expect(codes(validateSchedule(input).violations)).not.toContain(
      "shift_exact_per_week",
    );
  });

  it("checks birthday, approved leave and unavailability", () => {
    const input = single(CLEAN, (i) => {
      const e = i.employees[0];
      e.birthdayMonth = 11;
      e.birthdayDay = 10;
      i.absences = [
        {
          employeeId: e.id,
          dayCode: "AL",
          startDate: "2026-11-12",
          endDate: "2026-11-13",
        },
      ];
      i.unavailabilities = [
        {
          employeeId: e.id,
          date: "2026-11-16",
          startMinute: 480,
          endMinute: 600,
          reason: "Doctor",
        },
        {
          employeeId: e.id,
          date: "2026-11-17",
          startMinute: 1200,
          endMinute: 1440,
          reason: null,
        },
      ];
    });
    const v = validateSchedule(input).violations;
    expect(v.find((x) => x.code === "birthday_off")?.date).toBe("2026-11-10");
    expect(v.filter((x) => x.code === "approved_leave_is_fixed")).toHaveLength(
      2,
    );
    // A = 07:30–12:00 / 13:00–16:30 overlaps 08:00–10:00 but not 20:00–24:00.
    expect(
      v.filter((x) => x.code === "unavailability").map((x) => x.date),
    ).toEqual(["2026-11-16"]);
  });

  it("accepts rest days and public holidays inside a leave range", () => {
    const grid = [...CLEAN];
    grid[8] = "AL";
    grid[9] = "AL";
    grid[10] = "PH"; // Nov 11 is a public holiday
    grid[11] = "AL";
    const input = single(grid, (i) => {
      i.absences = [
        {
          employeeId: EMPLOYEE,
          dayCode: "AL",
          startDate: "2026-11-07",
          endDate: "2026-11-12",
        },
      ];
    });
    expect(codes(validateSchedule(input).violations)).not.toContain(
      "approved_leave_is_fixed",
    );
  });

  it("requires a full weekend off when the employee needs one", () => {
    const withWeekends = single(CLEAN, (i) => {
      i.employees[0].requiresMonthlyWeekendOff = true;
    });
    expect(codes(validateSchedule(withWeekends).violations)).not.toContain(
      "weekend_off_per_month",
    );
    // Work every Sunday after Nov 1: no full weekend off.
    const grid = CLEAN.map((code, i) => (i > 0 && i % 7 === 0 ? "A" : code));
    const noWeekend = single(grid, (i) => {
      i.employees[0].requiresMonthlyWeekendOff = true;
    });
    expect(codes(validateSchedule(noWeekend).violations)).toContain(
      "weekend_off_per_month",
    );
  });

  it("honours disabled and soft rules", () => {
    const grid = [...CLEAN];
    grid[1] = "B";
    grid[2] = "D";
    const disabled = single(grid, (i) => {
      const rule = i.rules.find(
        (r) => r.code === "min_rest_between_shifts_hours",
      );
      if (rule) rule.isActive = false;
    });
    expect(codes(validateSchedule(disabled).violations)).not.toContain(
      "min_rest_between_shifts_hours",
    );
    const soft = single(grid, (i) => {
      i.rules.push({
        code: "min_rest_between_shifts_hours",
        scope: "employee",
        sectionId: null,
        employeeId: EMPLOYEE,
        value: { value: 11 },
        isHard: false,
        isActive: true,
      });
    });
    expect(
      validateSchedule(soft).violations.find(
        (v) => v.code === "min_rest_between_shifts_hours",
      )?.severity,
    ).toBe("warning");
  });

  it("applies staffing requirements with date overrides", () => {
    const input = single(CLEAN, (i) => {
      i.staffingRequirements = [
        {
          sectionId: "reception",
          shiftTypeId: "reception:A",
          weekday: null,
          minStaff: 1,
          maxStaff: null,
          validFrom: null,
          validTo: null,
        },
      ];
      i.staffingOverrides = [
        {
          sectionId: "reception",
          shiftTypeId: "reception:A",
          date: "2026-11-02",
          minStaff: 2,
          maxStaff: null,
          reason: "Trade fair",
        },
      ];
    });
    const { violations, coverage } = validateSchedule(input);
    const minStaff = violations.filter((v) => v.code === "min_staff");
    expect(minStaff[0]).toMatchObject({ date: "2026-11-01" }); // OF day
    expect(minStaff[1]).toMatchObject({ date: "2026-11-02" });
    expect(minStaff[1].message).toContain("Trade fair");
    expect(
      coverage.find(
        (c) => c.date === "2026-11-03" && c.shiftTypeId === "reception:A",
      ),
    ).toMatchObject({ count: 1, minStaff: 1 });
  });

  it("checks same days off and different weekends off", () => {
    const input = november2026();
    const found = validateSchedule(input).violations;
    // The demo schedule breaks both relations once (deliberate mistakes).
    expect(
      found.filter((x) => x.code === "same_days_off").map((x) => x.date),
    ).toEqual(["2026-11-19"]);
    expect(
      found
        .filter((x) => x.code === "different_weekend_off")
        .map((x) => x.date),
    ).toEqual(["2026-11-07"]);

    // Ingrid Solberg rests again on her partner's rest day: the first one goes away.
    for (const a of input.assignments) {
      if (a.employeeId === "Ingrid Solberg" && a.date === "2026-11-19") {
        a.shiftTypeId = null;
        a.dayCode = "OF";
      }
    }
    expect(codes(validateSchedule(input).violations)).not.toContain(
      "same_days_off",
    );
  });
});

describe("validator — November 2026 demo schedule", () => {
  const result = validateSchedule(november2026());
  const errors = result.violations.filter((v) => v.severity === "error");
  const summary = Object.fromEntries(
    summarizeViolations(result.violations).map((s) => [s.code, s.error]),
  );
  const at = (code: string) =>
    errors
      .filter((v) => v.code === code)
      .map((v) => `${v.employeeId ?? v.sectionId} ${v.date}`);

  it("reports each deliberate mistake", () => {
    expect(at("birthday_off")).toEqual(["Yuki Tanaka 2026-11-14"]);
    expect(at("min_rest_between_shifts_hours")).toEqual([
      "Leila Haddad 2026-11-05",
    ]);
    expect(at("shift_eligibility")).toEqual(["Tomasz Nowak 2026-11-05"]);
    expect(at("min_staff")).toContain("restaurant 2026-11-01");
    expect(summary.max_consecutive_work_days).toBeGreaterThan(0);
  });

  it("keeps approved leave, weekends off and time off in lieu", () => {
    expect(summary.approved_leave_is_fixed ?? 0).toBe(0);
    expect(summary.weekend_off_per_month ?? 0).toBe(0);
    expect(summary.unassigned_day ?? 0).toBe(0);
    expect(
      result.violations.filter((v) => v.code === "monthly_tl_days"),
    ).toEqual([]);
  });

  it("computes weekly and monthly totals for the night auditor", () => {
    const amara = result.employeeTotals.find(
      (t) => t.employeeId === "Amara Okafor",
    );
    expect(amara?.weeks).toHaveLength(6);
    expect(amara?.weeks.find((w) => w.weekKey === "2026-W46")).toMatchObject({
      workedMinutes: 5 * 450,
      expectedMinutes: 5 * 450,
      isPartial: false,
      deltaMinutes: 0,
    });
    expect(amara?.month.deltaMinutes).toBe(0);
    expect(amara?.shiftCounts["reception:D"]).toBe(21);
  });
});
