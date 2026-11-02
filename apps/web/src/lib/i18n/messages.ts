import type { Dictionary } from "./dictionaries";

const PERIOD_RE = /^Period (\d+): (.*)$/;

/**
 * Translates an English validation message of the shared schemas or of the
 * domain (shift periods: "Period 2: end must be after start"). Unknown messages
 * are returned as they are.
 */
export function translateMessage(t: Dictionary, message: string): string {
  const known = t.validation[message];
  if (known) return known;
  const period = PERIOD_RE.exec(message);
  if (period) {
    const rest = t.validation[period[2]] ?? period[2];
    return `${t.sections.period(Number(period[1]))}: ${rest}`;
  }
  return message;
}
