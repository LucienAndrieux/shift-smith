import { type IsoDate, isDateInRange, monthDates } from "./calendar";
import type { Assignment, DayCode, Employee } from "./types";

/** Daily contract minutes = weekly contract minutes ÷ 5 (may be fractional). */
export function dailyContractMinutes(weeklyContractMinutes: number): number {
  return weeklyContractMinutes / 5;
}

export interface HourBankPeriodResult {
  dailyContractMinutes: number;
  /** Days counted (inside the employment window). */
  employedDays: number;
  /** Days whose code is not due (weekly rest, unpaid leave). */
  notDueDays: number;
  /** Days without any assignment (the month is incomplete for this employee). */
  unassignedDays: number;
  expectedMinutes: number;
  workedMinutes: number;
  creditedMinutes: number;
  /** worked + credited − expected, rounded to whole minutes. */
  deltaMinutes: number;
}

export interface HourBankInput {
  employee: Pick<Employee, "weeklyContractMinutes" | "hiredOn" | "leftOn">;
  dates: readonly IsoDate[];
  /** The employee's assignments (other employees' are ignored by date lookup only). */
  assignments: readonly Pick<Assignment, "date" | "shiftTypeId" | "dayCode">[];
  shiftPaidMinutes: ReadonlyMap<string, number>;
  dayCodes: ReadonlyMap<string, Pick<DayCode, "isDueDay" | "creditsTime">>;
}

/**
 * Hour-bank arithmetic for a set of dates:
 * - expected = daily contract × (days with a shift + days whose code is due);
 * - worked   = Σ paid minutes of assigned shifts;
 * - credited = daily contract × days whose code credits time;
 * - delta    = worked + credited − expected.
 * TL is due but credits nothing, so it is paid from the bank. Unassigned days count
 * in `expected` (callers should treat the period as incomplete).
 */
export function computeHourBank(input: HourBankInput): HourBankPeriodResult {
  const daily = dailyContractMinutes(input.employee.weeklyContractMinutes);
  const byDate = new Map(input.assignments.map((a) => [a.date, a]));
  const result: HourBankPeriodResult = {
    dailyContractMinutes: daily,
    employedDays: 0,
    notDueDays: 0,
    unassignedDays: 0,
    expectedMinutes: 0,
    workedMinutes: 0,
    creditedMinutes: 0,
    deltaMinutes: 0,
  };

  for (const date of input.dates) {
    if (!isDateInRange(date, input.employee.hiredOn, input.employee.leftOn)) {
      continue;
    }
    result.employedDays++;
    const cell = byDate.get(date);
    const dayCode = cell?.dayCode
      ? input.dayCodes.get(cell.dayCode)
      : undefined;

    if (!cell) {
      result.unassignedDays++;
      result.expectedMinutes += daily;
    } else if (cell.shiftTypeId) {
      result.expectedMinutes += daily;
      result.workedMinutes += input.shiftPaidMinutes.get(cell.shiftTypeId) ?? 0;
    } else if (dayCode) {
      if (dayCode.isDueDay) result.expectedMinutes += daily;
      else result.notDueDays++;
      if (dayCode.creditsTime) result.creditedMinutes += daily;
    }
  }

  result.expectedMinutes = Math.round(result.expectedMinutes);
  result.creditedMinutes = Math.round(result.creditedMinutes);
  result.deltaMinutes =
    result.workedMinutes + result.creditedMinutes - result.expectedMinutes;
  return result;
}

export function computeMonthlyHourBank(
  input: Omit<HourBankInput, "dates"> & { year: number; month: number },
): HourBankPeriodResult {
  return computeHourBank({
    ...input,
    dates: monthDates(input.year, input.month),
  });
}

export type HourBankEntryKind =
  | "opening_balance"
  | "monthly_close"
  | "manual_adjustment";

export interface HourBankEntry {
  id: string;
  entryDate: IsoDate;
  minutes: number;
  kind: HourBankEntryKind;
  createdAt?: string;
}

/** Entries in chronological order with the running balance after each one. */
export function withRunningBalance<T extends HourBankEntry>(
  entries: readonly T[],
): (T & { balance: number })[] {
  const sorted = [...entries].sort(
    (a, b) =>
      a.entryDate.localeCompare(b.entryDate) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
  let balance = 0;
  return sorted.map((entry) => {
    balance += entry.minutes;
    return { ...entry, balance };
  });
}

export function balanceOf(entries: readonly Pick<HourBankEntry, "minutes">[]) {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

export interface ClosePreviewRow {
  employeeId: string;
  /** Balance before this month's closing entry. */
  previousBalance: number;
  period: HourBankPeriodResult;
  /** False when the month has empty days: no entry is written for the employee. */
  included: boolean;
  newBalance: number;
}

/**
 * Closing preview for a month: one row per employee with the monthly delta and the
 * resulting balance. Employees with unassigned days are excluded from the close
 * (writing their delta would book every empty day as owed hours).
 */
export function buildClosePreview(
  periods: readonly { employeeId: string; period: HourBankPeriodResult }[],
  previousBalances: ReadonlyMap<string, number>,
): ClosePreviewRow[] {
  return periods.map(({ employeeId, period }) => {
    const previousBalance = previousBalances.get(employeeId) ?? 0;
    const included = period.unassignedDays === 0;
    return {
      employeeId,
      previousBalance,
      period,
      included,
      newBalance: included
        ? previousBalance + period.deltaMinutes
        : previousBalance,
    };
  });
}
