import { describe, expect, it } from "vitest";
import { november2026 } from "./__fixtures__/seed";
import { DEFAULT_DAY_CODES } from "./day-codes";
import { computeShiftDuration } from "./durations";
import {
  balanceOf,
  buildClosePreview,
  computeHourBank,
  computeMonthlyHourBank,
  dailyContractMinutes,
  withRunningBalance,
} from "./hour-bank";

const DAY_CODES = new Map(DEFAULT_DAY_CODES.map((d) => [d.code, d]));
const EMPLOYEE = {
  weeklyContractMinutes: 37.5 * 60,
  hiredOn: null,
  leftOn: null,
};
const DAILY = 450;

/** One day coded `code` (or a 480-minute shift "S"). */
function oneDay(code: string) {
  return computeHourBank({
    employee: EMPLOYEE,
    dates: ["2026-11-02"],
    assignments: [
      code === "S"
        ? { date: "2026-11-02", shiftTypeId: "S", dayCode: null }
        : { date: "2026-11-02", shiftTypeId: null, dayCode: code },
    ],
    shiftPaidMinutes: new Map([["S", 480]]),
    dayCodes: DAY_CODES,
  });
}

function novemberBank(employee: string) {
  const input = november2026();
  const emp = input.employees.find((e) => e.id === employee);
  if (!emp) throw new Error(`No employee ${employee}`);
  return computeMonthlyHourBank({
    year: 2026,
    month: 11,
    employee: emp,
    assignments: input.assignments.filter((a) => a.employeeId === employee),
    shiftPaidMinutes: new Map(
      input.shiftTypes.map((s) => [
        s.id,
        computeShiftDuration(s.periods).paidMinutes,
      ]),
    ),
    dayCodes: new Map(input.dayCodes.map((d) => [d.code, d])),
  });
}

describe("hour bank", () => {
  it("derives the daily contract from the weekly contract", () => {
    expect(dailyContractMinutes(37.5 * 60)).toBe(450);
    expect(dailyContractMinutes(30 * 60)).toBe(360);
  });

  it("counts a shift as due and pays its minutes", () => {
    expect(oneDay("S")).toMatchObject({
      expectedMinutes: DAILY,
      workedMinutes: 480,
      creditedMinutes: 0,
      deltaMinutes: 30,
    });
  });

  // One case per day code: [code, expected, credited, delta].
  it.each([
    ["OF", 0, 0, 0],
    ["PH", DAILY, DAILY, 0],
    ["AL", DAILY, DAILY, 0],
    ["SL", DAILY, DAILY, 0],
    ["BD", DAILY, DAILY, 0],
    ["TL", DAILY, 0, -DAILY],
    ["TR", DAILY, DAILY, 0],
    ["OL", DAILY, DAILY, 0],
    ["UL", 0, 0, 0],
  ] as const)(
    "%s: expected %i, credited %i, delta %i",
    (code, expected, credited, delta) => {
      expect(oneDay(code)).toMatchObject({
        expectedMinutes: expected,
        creditedMinutes: credited,
        deltaMinutes: delta,
        notDueDays: expected === 0 ? 1 : 0,
      });
    },
  );

  it("covers every built-in day code", () => {
    expect(DEFAULT_DAY_CODES.map((d) => d.code)).toEqual([
      "OF",
      "PH",
      "AL",
      "SL",
      "BD",
      "TL",
      "TR",
      "OL",
      "UL",
    ]);
  });

  it("counts empty days as due and reports them", () => {
    const result = computeHourBank({
      employee: EMPLOYEE,
      dates: ["2026-11-02", "2026-11-03"],
      assignments: [],
      shiftPaidMinutes: new Map(),
      dayCodes: DAY_CODES,
    });
    expect(result).toMatchObject({
      unassignedDays: 2,
      expectedMinutes: 2 * DAILY,
      deltaMinutes: -2 * DAILY,
    });
  });

  it("lets a TL day consume the bank (Rafael Moreno, Nov 2026)", () => {
    // 20 shifts + 1 TL on the 21 weekdays; weekends are OF and not due.
    const result = novemberBank("Rafael Moreno");
    expect(result).toMatchObject({
      expectedMinutes: 21 * DAILY,
      creditedMinutes: 0,
      notDueDays: 9,
    });
    expect(result.deltaMinutes).toBe(result.workedMinutes - 21 * DAILY);
  });

  it("is neutral for a month of sick leave (Nadia Belkacem)", () => {
    const result = novemberBank("Nadia Belkacem");
    expect(result.workedMinutes).toBe(0);
    expect(result.deltaMinutes).toBe(0);
  });

  it("respects the employment window", () => {
    const result = computeMonthlyHourBank({
      year: 2026,
      month: 11,
      employee: { ...EMPLOYEE, hiredOn: "2026-11-20" },
      assignments: [],
      shiftPaidMinutes: new Map(),
      dayCodes: new Map(),
    });
    expect(result.employedDays).toBe(11);
  });

  it("computes running balances in date order", () => {
    const rows = withRunningBalance([
      { id: "b", entryDate: "2026-11-30", minutes: 480, kind: "monthly_close" },
      {
        id: "a",
        entryDate: "2026-10-31",
        minutes: 30,
        kind: "opening_balance",
      },
      {
        id: "c",
        entryDate: "2026-12-05",
        minutes: -60,
        kind: "manual_adjustment",
      },
    ]);
    expect(rows.map((r) => [r.id, r.balance])).toEqual([
      ["a", 30],
      ["b", 510],
      ["c", 450],
    ]);
    expect(balanceOf(rows)).toBe(450);
  });
});

describe("buildClosePreview", () => {
  it("adds the monthly delta and excludes incomplete months", () => {
    const complete = novemberBank("Amara Okafor");
    const incomplete = { ...complete, unassignedDays: 3 };
    const rows = buildClosePreview(
      [
        { employeeId: "Amara Okafor", period: complete },
        { employeeId: "Someone else", period: incomplete },
      ],
      new Map([
        ["Amara Okafor", 60],
        ["Someone else", 30],
      ]),
    );
    expect(rows.map((r) => [r.employeeId, r.included, r.newBalance])).toEqual([
      ["Amara Okafor", true, 60 + complete.deltaMinutes],
      ["Someone else", false, 30],
    ]);
  });
});
