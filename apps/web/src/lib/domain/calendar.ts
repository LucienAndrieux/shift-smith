import { getISOWeek, getISOWeekYear } from "date-fns";
import type { Locale } from "../i18n/config";

/** Calendar dates are "YYYY-MM-DD" strings. Weekdays are ISO: 1 = Monday … 7 = Sunday. */
export type IsoDate = string;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: IsoDate): [number, number, number] {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid date: "${date}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Local-time Date at midnight; only used for date-fns calendar helpers. */
function toLocalDate(date: IsoDate): Date {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d);
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDates(year: number, month: number): IsoDate[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) =>
    toIsoDate(year, month, i + 1),
  );
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return toIsoDate(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    result.getUTCDate(),
  );
}

/** Number of days from `a` to `b` (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

export function weekday(date: IsoDate): Weekday {
  const [y, m, d] = parts(date);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

export function isWeekend(date: IsoDate): boolean {
  return weekday(date) >= 6;
}

export function dayOfMonth(date: IsoDate): number {
  return parts(date)[2];
}

export function yearMonthOf(date: IsoDate): { year: number; month: number } {
  const [year, month] = parts(date);
  return { year, month };
}

/** ISO week key such as "2026-W41". */
export function isoWeekKey(date: IsoDate): string {
  const local = toLocalDate(date);
  return `${getISOWeekYear(local)}-W${String(getISOWeek(local)).padStart(2, "0")}`;
}

/** Monday of the ISO week containing `date`. */
export function isoWeekStart(date: IsoDate): IsoDate {
  return addDays(date, 1 - weekday(date));
}

export interface IsoWeek {
  key: string;
  /** Monday → Sunday, all 7 dates (may extend outside the month). */
  dates: IsoDate[];
}

/** ISO weeks overlapping the given month, in order. */
export function isoWeeksOfMonth(year: number, month: number): IsoWeek[] {
  const dates = monthDates(year, month);
  const weeks: IsoWeek[] = [];
  let monday = isoWeekStart(dates[0]);
  const last = dates[dates.length - 1];
  while (diffDays(monday, last) >= 0) {
    weeks.push({
      key: isoWeekKey(monday),
      dates: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    });
    monday = addDays(monday, 7);
  }
  return weeks;
}

export function isDateInRange(
  date: IsoDate,
  start: IsoDate | null | undefined,
  end: IsoDate | null | undefined,
): boolean {
  return (!start || date >= start) && (!end || date <= end);
}

/** Monday → Sunday, short ("Mon", "Lun", "Seg"). */
export const WEEKDAY_SHORT: Record<Locale, readonly string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
  pt: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
};

/** Monday → Sunday, in full. */
export const WEEKDAY_NAMES: Record<Locale, readonly string[]> = {
  en: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
  pt: [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ],
};

export function weekdayShort(day: Weekday, locale: Locale = "en"): string {
  return WEEKDAY_SHORT[locale][day - 1];
}

export const MONTH_NAMES: Record<Locale, readonly string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  fr: [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ],
  pt: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],
};

const MONTH_SHORT: Record<Locale, readonly string[]> = {
  en: MONTH_NAMES.en.map((m) => m.slice(0, 3)),
  fr: [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ],
  pt: [
    "jan.",
    "fev.",
    "mar.",
    "abr.",
    "mai.",
    "jun.",
    "jul.",
    "ago.",
    "set.",
    "out.",
    "nov.",
    "dez.",
  ],
};

/** "Oct 9", "9 oct.", "9 out." */
export function formatDayMonth(date: IsoDate, locale: Locale = "en"): string {
  const [, m, d] = parts(date);
  const month = MONTH_SHORT[locale][m - 1];
  return locale === "en" ? `${month} ${d}` : `${d} ${month}`;
}

/** "October 2026", "Octobre 2026", "Outubro 2026" */
export function formatMonth(
  year: number,
  month: number,
  locale: Locale = "en",
): string {
  return `${MONTH_NAMES[locale][month - 1]} ${year}`;
}
