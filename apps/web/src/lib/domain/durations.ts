import { MINUTES_PER_DAY } from "./time";

export interface ShiftPeriod {
  startMinute: number;
  endMinute: number;
  unpaidBreakMinutes: number;
}

export interface ShiftDuration {
  paidMinutes: number;
  firstStartMinute: number;
  lastEndMinute: number;
}

/** Sorted copy of the periods (by start). */
export function sortPeriods<T extends ShiftPeriod>(periods: readonly T[]): T[] {
  return [...periods].sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * Paid minutes = Σ (end − start − unpaid break). Gaps between periods are unpaid.
 * Throws on empty or invalid periods.
 */
export function computeShiftDuration(
  periods: readonly ShiftPeriod[],
): ShiftDuration {
  const errors = validatePeriods(periods);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const sorted = sortPeriods(periods);
  return {
    paidMinutes: sorted.reduce(
      (sum, p) => sum + (p.endMinute - p.startMinute - p.unpaidBreakMinutes),
      0,
    ),
    firstStartMinute: sorted[0].startMinute,
    lastEndMinute: sorted[sorted.length - 1].endMinute,
  };
}

/** Human-readable problems with a list of periods; empty when valid. */
export function validatePeriods(periods: readonly ShiftPeriod[]): string[] {
  const errors: string[] = [];
  if (periods.length === 0) errors.push("A shift needs at least one period");
  const sorted = sortPeriods(periods);
  sorted.forEach((p, i) => {
    const label = `Period ${i + 1}`;
    if (
      !Number.isInteger(p.startMinute) ||
      !Number.isInteger(p.endMinute) ||
      p.startMinute < 0 ||
      p.endMinute > MINUTES_PER_DAY
    ) {
      errors.push(`${label}: times must be between 00:00 and 24:00`);
    }
    if (p.endMinute <= p.startMinute) {
      errors.push(`${label}: end must be after start`);
    }
    if (
      p.unpaidBreakMinutes < 0 ||
      p.unpaidBreakMinutes >= p.endMinute - p.startMinute
    ) {
      errors.push(`${label}: unpaid break must be shorter than the period`);
    }
    const previous = sorted[i - 1];
    if (previous && p.startMinute < previous.endMinute) {
      errors.push(`${label}: overlaps the previous period`);
    }
  });
  return errors;
}
