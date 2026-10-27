"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readableTextColor } from "@/lib/colors";
import {
  formatDayMonth,
  isoWeeksOfMonth,
  WEEKDAY_SHORT,
} from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
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
  const weeks = useMemo(
    () => isoWeeksOfMonth(view.year, view.month),
    [view.year, view.month],
  );
  const [weekKey, setWeekKey] = useState(weeks[0]?.key ?? "");
  const week = weeks.find((w) => w.key === weekKey) ?? weeks[0];
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
  const weekTotals = new Map(
    view.totals.map((t) => [
      t.employeeId,
      t.weeks.find((w) => w.weekKey === week?.key),
    ]),
  );

  if (!week) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={week.key} onValueChange={setWeekKey}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.key} value={w.key}>
                {w.key} · {formatDayMonth(w.dates[0])} –{" "}
                {formatDayMonth(w.dates[6])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {week.dates.some((d) => !inMonth.has(d)) && (
          <span className="text-sm text-muted-foreground">
            Days outside {view.month}/{view.year} are not part of this schedule.
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
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-40 border-b bg-background px-2 py-2 text-left font-medium">
                Employee
              </th>
              {week.dates.map((d, i) => (
                <th
                  key={d}
                  className={cn(
                    "min-w-28 border-b border-l px-2 py-2 text-left font-medium",
                    i >= 5 && "bg-muted",
                    holiday.get(d) && "bg-amber-200/70 dark:bg-amber-900/50",
                  )}
                  title={holiday.get(d) ?? undefined}
                >
                  {WEEKDAY_SHORT[i]} {formatDayMonth(d)}
                </th>
              ))}
              <th className="border-b border-l px-2 py-2 text-right font-medium">
                Week
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.id}>
                <tr>
                  <td
                    colSpan={9}
                    className="border-y bg-muted/60 px-2 py-1 font-semibold"
                  >
                    {section.name}
                  </td>
                </tr>
                {view.employees
                  .filter((e) => e.sectionId === section.id)
                  .map((employee) => {
                    const total = weekTotals.get(employee.id);
                    return (
                      <tr key={employee.id}>
                        <td className="sticky left-0 z-[5] border-b bg-background px-2 py-1 whitespace-nowrap">
                          {employee.name}
                        </td>
                        {week.dates.map((d) => {
                          if (!inMonth.has(d)) {
                            return (
                              <td
                                key={d}
                                className="border-b border-l px-2 text-muted-foreground"
                              >
                                —
                              </td>
                            );
                          }
                          const cell = view.cells[employee.id]?.[d];
                          const shift = cell?.shiftTypeId
                            ? index.shiftById.get(cell.shiftTypeId)
                            : undefined;
                          const dayCode = cell?.dayCode
                            ? index.dayCodeByCode.get(cell.dayCode)
                            : undefined;
                          const color = shift?.color ?? dayCode?.color;
                          return (
                            <td
                              key={d}
                              className="border-b border-l px-2 py-1 align-top"
                            >
                              {color && (
                                <span
                                  className="inline-flex min-w-6 justify-center rounded px-1 text-xs font-bold"
                                  style={{
                                    backgroundColor: color,
                                    color: readableTextColor(color),
                                  }}
                                >
                                  {shift?.code ?? dayCode?.code}
                                </span>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {shift ? shift.hours : (dayCode?.label ?? "")}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b border-l px-2 text-right font-mono whitespace-nowrap">
                          {total
                            ? `${formatHoursMinutes(total.workedMinutes + total.creditedMinutes)}`
                            : ""}
                          <div className="text-xs text-muted-foreground">
                            / {formatHoursMinutes(total?.expectedMinutes ?? 0)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Phone layout: a day strip, then everyone's shift for that day, by section. */
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
  return (
    <div className="flex flex-col gap-3 md:hidden">
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
                {WEEKDAY_SHORT[i].slice(0, 2)}
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
          Holiday: {holiday.get(day)}
        </p>
      )}
      {sections.map((section) => {
        const employees = view.employees.filter(
          (e) => e.sectionId === section.id,
        );
        if (employees.length === 0) return null;
        return (
          <div key={section.id} className="overflow-hidden rounded-md border">
            <div className="bg-muted/60 px-3 py-1.5 text-sm font-semibold">
              {section.name}
            </div>
            <ul className="divide-y">
              {employees.map((employee) => {
                const cell = view.cells[employee.id]?.[day];
                const shift = cell?.shiftTypeId
                  ? index.shiftById.get(cell.shiftTypeId)
                  : undefined;
                const dayCode = cell?.dayCode
                  ? index.dayCodeByCode.get(cell.dayCode)
                  : undefined;
                const color = shift?.color ?? dayCode?.color;
                return (
                  <li
                    key={employee.id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span
                      className="inline-flex min-w-8 shrink-0 justify-center rounded px-1 py-0.5 text-xs font-bold"
                      style={
                        color
                          ? {
                              backgroundColor: color,
                              color: readableTextColor(color),
                            }
                          : undefined
                      }
                    >
                      {shift?.code ?? dayCode?.code ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {employee.name}
                    </span>
                    <span className="max-w-[55%] text-right text-xs text-muted-foreground">
                      {shift ? shift.hours : (dayCode?.label ?? "Empty")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
