import {
  addDays,
  daysInMonth,
  type IsoDate,
  toIsoDate,
  weekday,
} from "./calendar";
import type { Holiday } from "./types";

/**
 * Countries whose public holidays can be generated (national holidays only;
 * regional and municipal ones are added in the app). GB-ENG = England and
 * Wales bank holidays.
 */
export const HOLIDAY_COUNTRIES = ["FR", "PT", "GB-ENG"] as const;
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
  const easter = easterSunday(year);
  const fixed = (month: number, day: number, name: string) => ({
    date: toIsoDate(year, month, day),
    name,
  });
  switch (country) {
    case "FR": {
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
    case "PT": {
      return [
        fixed(1, 1, "New Year's Day"),
        { date: addDays(easter, -2), name: "Good Friday" },
        { date: easter, name: "Easter Sunday" },
        fixed(4, 25, "Freedom Day"),
        fixed(5, 1, "Labour Day"),
        { date: addDays(easter, 60), name: "Corpus Christi" },
        fixed(6, 10, "Portugal Day"),
        fixed(8, 15, "Assumption Day"),
        fixed(10, 5, "Republic Day"),
        fixed(11, 1, "All Saints' Day"),
        fixed(12, 1, "Restoration of Independence"),
        fixed(12, 8, "Immaculate Conception"),
        fixed(12, 25, "Christmas Day"),
      ].sort((x, y) => x.date.localeCompare(y.date));
    }
    case "GB-ENG": {
      // Regular rules only: one-off changes (e.g. a moved May holiday or a
      // coronation) are added in the app.
      const christmas = toIsoDate(year, 12, 25);
      const christmasWeekday = weekday(christmas);
      // Christmas and Boxing Day falling on a weekend move to the next free weekdays.
      const christmasShift = christmasWeekday >= 6 ? 2 : 0;
      const boxingShift =
        christmasWeekday === 5 || christmasWeekday === 6 ? 2 : 0;
      return [
        { date: nextWeekday(toIsoDate(year, 1, 1)), name: "New Year's Day" },
        { date: addDays(easter, -2), name: "Good Friday" },
        { date: addDays(easter, 1), name: "Easter Monday" },
        { date: firstMonday(year, 5), name: "Early May Bank Holiday" },
        { date: lastMonday(year, 5), name: "Spring Bank Holiday" },
        { date: lastMonday(year, 8), name: "Summer Bank Holiday" },
        { date: addDays(christmas, christmasShift), name: "Christmas Day" },
        {
          date: addDays(toIsoDate(year, 12, 26), boxingShift),
          name: "Boxing Day",
        },
      ].sort((x, y) => x.date.localeCompare(y.date));
    }
  }
}

/** The date itself, or the following Monday when it falls on a weekend. */
function nextWeekday(date: IsoDate): IsoDate {
  const day = weekday(date);
  return day === 6 ? addDays(date, 2) : day === 7 ? addDays(date, 1) : date;
}

function firstMonday(year: number, month: number): IsoDate {
  const first = toIsoDate(year, month, 1);
  return addDays(first, (8 - weekday(first)) % 7);
}

function lastMonday(year: number, month: number): IsoDate {
  const last = toIsoDate(year, month, daysInMonth(year, month));
  return addDays(last, -((weekday(last) + 6) % 7));
}
