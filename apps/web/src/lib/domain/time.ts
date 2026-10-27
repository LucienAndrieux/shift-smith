/** Times of day are integer minutes from midnight, 0–1440 (1440 = 24:00). */

export const MINUTES_PER_DAY = 1440;

/** Parses "HH:MM" (00:00–24:00) into minutes from midnight. */
export function parseTimeOfDay(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time of day: "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (minutes > 59 || total > MINUTES_PER_DAY) {
    throw new Error(`Invalid time of day: "${value}"`);
  }
  return total;
}

/** Formats minutes from midnight as "HH:MM" (1440 → "24:00"). */
export function formatTimeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Formats a signed duration in minutes as hours, e.g. 456 → "7.6h", -30 → "-0.5h". */
export function formatHours(minutes: number, fractionDigits = 1): string {
  const hours = minutes / 60;
  const rounded = Number(hours.toFixed(fractionDigits));
  return `${Object.is(rounded, -0) ? 0 : rounded}h`;
}

/** Formats a signed duration as "+7h36" / "-0h30". */
export function formatHoursMinutes(minutes: number, signed = false): string {
  const sign = minutes < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`;
}
