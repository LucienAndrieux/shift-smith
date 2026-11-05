"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useT } from "@/components/i18n-provider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { softCodeStyle } from "@/lib/colors";
import {
  formatDayMonth,
  isoWeeksOfMonth,
  WEEKDAY_SHORT,
} from "@/lib/domain/calendar";
import { cn } from "@/lib/utils";
import type { View, ViewIndex } from "./types";

export function WeekView({
  view,
  index,
  sectionId,
}: {
  view: View;
  index: ViewIndex;
  sectionId: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const weeks = useMemo(
    () => isoWeeksOfMonth(view.year, view.month),
    [view.year, view.month],
  );
  const [weekKey, setWeekKey] = useState(weeks[0]?.key ?? "");
  const week = weeks.find((w) => w.key === weekKey) ?? weeks[0];
  // Keep the chosen week in view when the strip scrolls (phones).
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = strip.current;
    const item = box?.querySelector<HTMLElement>('[data-state="on"]');
    if (!week || !box || !item) return;
    // Horizontal only: scrollIntoView would also scroll the page.
    const left = item.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (left + item.offsetWidth > box.scrollLeft + box.clientWidth)
      box.scrollLeft = left + item.offsetWidth - box.clientWidth;
  }, [week]);
  const inMonth = new Set(view.dates.map((d) => d.date));
  // Phones show one day at a time.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day =
    week?.dates.find((d) => d === pickedDay && inMonth.has(d)) ??
    week?.dates.find((d) => inMonth.has(d)) ??
    null;
  const holiday = new Map(view.dates.map((d) => [d.date, d.holiday]));
  const sections = view.sections.filter(
    (s) => !sectionId || s.id === sectionId,
  );

  if (!week) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {/* One segment per ISO week of the month; scrolls sideways on phones. */}
        <div ref={strip} className="-mx-1 overflow-x-auto px-1 pb-1">
          <ToggleGroup
            type="single"
            variant="outline"
            value={week.key}
            onValueChange={(v) => v && setWeekKey(v)}
            aria-label={t.week.pick}
            className="w-max"
          >
            {weeks.map((w) => (
              <ToggleGroupItem
                key={w.key}
                value={w.key}
                className="h-auto flex-col gap-0 px-3 py-1.5 data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <span className="text-[11px] font-normal opacity-70">
                  {t.week.number(Number(w.key.slice(-2)))}
                </span>
                <span className="text-sm font-medium whitespace-nowrap">
                  {formatDayMonth(w.dates[0], locale)} –{" "}
                  {formatDayMonth(w.dates[6], locale)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {week.dates.some((d) => !inMonth.has(d)) && (
          <span className="text-sm text-muted-foreground">
            {t.week.outside(`${view.month}/${view.year}`)}
          </span>
        )}
      </div>
      {day && (
        <DayList
          view={view}
          index={index}
          sections={sections}
          dates={week.dates}
          inMonth={inMonth}
          holiday={holiday}
          day={day}
          onDayChange={setPickedDay}
        />
      )}
      <div className="hidden flex-col gap-8 md:flex">
        {sections.map((section) => (
          <SectionWeek
            key={section.id}
            view={view}
            index={index}
            section={section}
            dates={week.dates}
            inMonth={inMonth}
            holiday={holiday}
          />
        ))}
      </div>
    </div>
  );
}

/** 0 = Monday … 6 = Sunday. */
function weekday(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Today's date and the minute of the day in the hotel's time zone, refreshed
 * every 30 seconds. Null until mounted: the server render has no "now".
 */
function useNow(timeZone: string) {
  const [now, setNow] = useState<{ date: string; minute: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const [date, time] = formatInTimeZone(
        new Date(),
        timeZone,
        "yyyy-MM-dd HH:mm",
      ).split(" ");
      const [h, m] = time.split(":").map(Number);
      setNow({ date, minute: h * 60 + m });
    };
    read();
    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  return now;
}

/** Height of one hour in the time grid. */
const HOUR_PX = 40;

/** One shift on one day: everyone working it, listed in the same block. */
interface Block {
  shiftId: string;
  names: string[];
  color: string;
  hours: string;
  periods: { start: number; end: number }[];
  lane: number;
  /** Lanes of its group of overlapping shifts. */
  lanes: number;
}

/**
 * The shifts of one section on one day, each in a lane so that shifts at the
 * same time sit side by side (a shift keeps one lane for all its periods).
 * Lanes are counted per group of overlapping shifts: a shift alone at its hours
 * takes the full width.
 */
function layoutDay(blocks: Omit<Block, "lane" | "lanes">[]): Block[] {
  const span = (b: Omit<Block, "lane" | "lanes">) => ({
    first: b.periods[0].start,
    last: Math.max(...b.periods.map((p) => p.end)),
  });
  const sorted = [...blocks].sort((a, b) => span(a).first - span(b).first);
  const placed: Block[] = [];
  let group: Block[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const close = () => {
    for (const b of group) b.lanes = Math.max(1, laneEnds.length);
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    const { first, last } = span(b);
    if (group.length > 0 && first >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= first);
    if (lane < 0) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = last;
    groupEnd = Math.max(group.length > 0 ? groupEnd : 0, last);
    group.push({ ...b, lane, lanes: 1 });
  }
  close();
  return placed;
}

/**
 * One section's week as a calendar: days across, hours down, each shift a block
 * named after the employee. Days off and absences sit in a row above the hours.
 */
function SectionWeek({
  view,
  index,
  section,
  dates,
  inMonth,
  holiday,
}: {
  view: View;
  index: ViewIndex;
  section: View["sections"][number];
  dates: string[];
  inMonth: Set<string>;
  holiday: Map<string, string | null>;
}) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(view.timeZone);
  const employees = view.employees.filter((e) => e.sectionId === section.id);
  if (employees.length === 0) return null;

  const days = dates.map((date) => {
    const shifts = new Map<string, Omit<Block, "lane" | "lanes">>();
    const away: {
      employeeId: string;
      name: string;
      color: string;
      label: string;
    }[] = [];
    if (inMonth.has(date)) {
      for (const employee of employees) {
        const cell = view.cells[employee.id]?.[date];
        const shift = cell?.shiftTypeId
          ? index.shiftById.get(cell.shiftTypeId)
          : undefined;
        if (shift && shift.periods.length > 0) {
          const block = shifts.get(shift.id);
          if (block) block.names.push(employee.name);
          else
            shifts.set(shift.id, {
              shiftId: shift.id,
              names: [employee.name],
              color: shift.color,
              hours: shift.hours,
              periods: shift.periods,
            });
          continue;
        }
        const dayCode = cell?.dayCode
          ? index.dayCodeByCode.get(cell.dayCode)
          : undefined;
        if (dayCode)
          away.push({
            employeeId: employee.id,
            name: employee.name,
            color: dayCode.color,
            label: dayCode.label,
          });
      }
    }
    return { date, away, blocks: layoutDay([...shifts.values()]) };
  });

  // Hours shown: from the earliest start to the latest end of the week.
  const all = days.flatMap((d) => d.blocks.flatMap((b) => b.periods));
  const first = all.length
    ? Math.floor(Math.min(...all.map((p) => p.start)) / 60)
    : 8;
  const last = all.length
    ? Math.ceil(Math.max(...all.map((p) => p.end)) / 60)
    : 18;
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const height = hours.length * HOUR_PX;
  const top = (minute: number) => ((minute - first * 60) / 60) * HOUR_PX;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-center font-display text-xl font-bold tracking-tight">
        {section.name}
      </h2>
      <div className="overflow-x-auto pb-1">
        <div
          className={cn("grid w-full", dates.length > 1 && "min-w-[60rem]")}
          style={{
            gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))`,
          }}
        >
          {/* Day headers */}
          <div />
          {dates.map((d) => (
            <div
              key={d}
              title={holiday.get(d) ?? undefined}
              className={cn(
                "mx-1 mb-1.5 rounded-xl border bg-card py-2 text-center text-xs shadow-xs",
                weekday(d) >= 5 && "bg-muted/60",
                holiday.get(d) && "bg-amber-100 dark:bg-amber-900/40",
                !inMonth.has(d) && "opacity-40",
              )}
            >
              <div className="text-muted-foreground">
                {WEEKDAY_SHORT[locale][weekday(d)]}
              </div>
              <div className="text-sm font-semibold">
                {formatDayMonth(d, locale)}
              </div>
            </div>
          ))}

          {/* Days off and absences */}
          <div className="self-center pr-2 text-right text-[11px] leading-tight text-muted-foreground">
            {t.week.away}
          </div>
          {days.map((day) => (
            <div
              key={day.date}
              className="mx-1 mb-1.5 flex min-h-9 flex-wrap content-center justify-center gap-1 rounded-xl border bg-card p-1.5 shadow-xs"
            >
              {day.away.map((a) => (
                <span
                  key={a.employeeId}
                  title={a.label}
                  className="max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={softCodeStyle(a.color)}
                >
                  {a.name}
                </span>
              ))}
            </div>
          ))}

          {/* Hour labels */}
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground"
                style={{ top: top(h * 60) }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* One time column per day */}
          {days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "relative mx-1 overflow-hidden rounded-xl border bg-card shadow-xs",
                weekday(day.date) >= 5 && "bg-muted/30",
                !inMonth.has(day.date) && "bg-muted/50",
              )}
              style={{ height }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/70"
                  style={{ top: top(h * 60) }}
                />
              ))}
              {now?.date === day.date &&
                now.minute >= first * 60 &&
                now.minute <= last * 60 && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-brand"
                    style={{ top: top(now.minute) - 1 }}
                  >
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-brand" />
                  </div>
                )}
              {day.blocks.flatMap((b) =>
                b.periods.map((p) => (
                  <div
                    key={`${b.shiftId}-${p.start}`}
                    title={`${b.names.join(", ")} · ${b.hours}`}
                    className="absolute flex flex-col items-center justify-center-safe gap-1.5 overflow-hidden rounded-md px-1 py-1.5 text-center text-[11px] leading-tight font-medium"
                    style={{
                      ...softCodeStyle(b.color),
                      top: top(p.start) + 1,
                      height: Math.max(top(p.end) - top(p.start) - 2, 14),
                      left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / b.lanes}% - 4px)`,
                    }}
                  >
                    {b.names.map((name) => (
                      <div key={name} className="line-clamp-2 w-full">
                        {name}
                      </div>
                    ))}
                  </div>
                )),
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Phone layout: a day strip, then the time grid of that day, by section. */
function DayList({
  view,
  index,
  sections,
  dates,
  inMonth,
  holiday,
  day,
  onDayChange,
}: {
  view: View;
  index: ViewIndex;
  sections: View["sections"];
  dates: string[];
  inMonth: Set<string>;
  holiday: Map<string, string | null>;
  day: string;
  onDayChange: (day: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-5 md:hidden">
      <div className="grid grid-cols-7 gap-1">
        {dates.map((d, i) => {
          const enabled = inMonth.has(d);
          const active = d === day;
          return (
            <button
              key={d}
              type="button"
              disabled={!enabled}
              aria-pressed={active}
              onClick={() => onDayChange(d)}
              className={cn(
                "flex flex-col items-center rounded-lg border py-1.5 text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
                !enabled && "opacity-40",
                !active && holiday.get(d) && "border-amber-400",
              )}
            >
              <span className={active ? "" : "text-muted-foreground"}>
                {WEEKDAY_SHORT[locale][i].slice(0, 2)}
              </span>
              <span className="text-sm font-semibold">
                {Number(d.slice(8))}
              </span>
            </button>
          );
        })}
      </div>
      {holiday.get(day) && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t.week.holiday(holiday.get(day) ?? "")}
        </p>
      )}
      {sections.map((section) => (
        <SectionWeek
          key={section.id}
          view={view}
          index={index}
          section={section}
          dates={[day]}
          inMonth={inMonth}
          holiday={holiday}
        />
      ))}
    </div>
  );
}
