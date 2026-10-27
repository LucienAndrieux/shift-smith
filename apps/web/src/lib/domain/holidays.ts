import { addDays, type IsoDate, toIsoDate } from "./calendar";
import type { Holiday } from "./types";

/** Countries whose public holidays can be generated. */
export const HOLIDAY_COUNTRIES = ["FR"] as const;
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number];

export function isHolidayCountry(value: string): value is HolidayCountry {
  return (HOLIDAY_COUNTRIES as readonly string[]).includes(value);
}

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate(year, month, day);
}

/** Public holidays of a country for one year, in date order. */
export function publicHolidays(
  country: HolidayCountry,
  year: number,
): Holiday[] {
  switch (country) {
    case "FR": {
      const easter = easterSunday(year);
      const fixed = (month: number, day: number, name: string) => ({
        date: toIsoDate(year, month, day),
        name,
      });
      return [
        fixed(1, 1, "New Year's Day"),
        { date: addDays(easter, 1), name: "Easter Monday" },
        fixed(5, 1, "Labour Day"),
        fixed(5, 8, "Victory in Europe Day"),
        { date: addDays(easter, 39), name: "Ascension Day" },
        { date: addDays(easter, 50), name: "Whit Monday" },
        fixed(7, 14, "Bastille Day"),
        fixed(8, 15, "Assumption Day"),
        fixed(11, 1, "All Saints' Day"),
        fixed(11, 11, "Armistice Day"),
        fixed(12, 25, "Christmas Day"),
      ].sort((x, y) => x.date.localeCompare(y.date));
    }
  }
}
