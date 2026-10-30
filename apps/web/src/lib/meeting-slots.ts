import { fromZonedTime } from "date-fns-tz";
import { addDays, type IsoDate, weekday } from "@/lib/domain/calendar";
import { MEETING_SLOTS } from "@/lib/schemas/contact";

/** Length of a call. */
export const MEETING_MINUTES = 30;

/** A busy period of the developer's calendar (absolute instants). */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface DaySlots {
  date: IsoDate;
  /** Free start times ("HH:MM", developer's time zone), in order. */
  slots: string[];
}

/** Up to `count` weekdays from `first` on, none after `last`. */
export function meetingDays(
  first: IsoDate,
  count: number,
  last: IsoDate,
): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = first; d <= last && days.length < count; d = addDays(d, 1)) {
    if (weekday(d) <= 5) days.push(d);
  }
  return days;
}

/** Start and end instants of the call starting at `time` on `date`. */
export function slotInterval(
  date: IsoDate,
  time: string,
  timeZone: string,
): BusyInterval {
  const start = fromZonedTime(`${date}T${time}:00`, timeZone);
  return {
    start,
    end: new Date(start.getTime() + MEETING_MINUTES * 60_000),
  };
}

/** The slot overlaps one of the busy periods (touching ends do not count). */
export function isBusy(slot: BusyInterval, busy: readonly BusyInterval[]) {
  return busy.some((b) => slot.start < b.end && slot.end > b.start);
}

/** Every offered start time of each day, minus those overlapping `busy`. */
export function freeSlots(
  days: readonly IsoDate[],
  busy: readonly BusyInterval[],
  timeZone: string,
): DaySlots[] {
  return days.map((date) => ({
    date,
    slots: MEETING_SLOTS.filter(
      (time) => !isBusy(slotInterval(date, time, timeZone), busy),
    ),
  }));
}
