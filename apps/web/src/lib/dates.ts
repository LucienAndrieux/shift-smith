import { enGB, fr, pt } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type { Locale } from "@/lib/i18n/config";

const DATE_FNS_LOCALES = { en: enGB, fr, pt };

/** The hotel's time zone (server side), e.g. "Europe/Paris". */
export const APP_TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Paris";

/** Today's date in the hotel's time zone as YYYY-MM-DD. */
export function today(now = new Date()): string {
  return formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
}

export function currentYearMonth(now = new Date()) {
  const [year, month] = today(now).split("-").map(Number);
  return { year, month };
}

/** "26 Oct 2026, 19:40" in the hotel's time zone. */
export function formatDateTime(
  value: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), APP_TIME_ZONE, "d MMM yyyy, HH:mm", {
    locale: DATE_FNS_LOCALES[locale],
  });
}
