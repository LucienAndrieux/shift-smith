"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, Fragment, useMemo, useState } from "react";
import { readableTextColor } from "@/lib/colors";
import { formatDayMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { violationIdentity } from "@/lib/domain/validator";
import { cn } from "@/lib/utils";
import { CellEditor } from "./cell-editor";
import { DayErrorsDialog } from "./day-errors-dialog";
import { CellFixDialog, type FixIssue } from "./fix-dialog";
import type { View, ViewCell, ViewEmployee, ViewIndex } from "./types";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function MonthGrid({
  view,
  index,
  sectionId,
  canEdit,
  canPlan,
}: {
  view: View;
  index: ViewIndex;
  /** null = all sections */
  sectionId: string | null;
  canEdit: boolean;
  /** Admin or demo manager: cells outlined in red open the fix suggestions. */
  canPlan: boolean;
}) {
  /** Cell (`employeeId|date`) whose editor or fix dialog is open. */
  const [editing, setEditing] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  /** Day whose error summary is open. */
  const [openDay, setOpenDay] = useState<string | null>(null);

  const sections = view.sections.filter(
    (s) => !sectionId || s.id === sectionId,
  );

  const errorCells = useMemo(() => {
    const map = new Map<string, FixIssue[]>();
    for (const v of view.violations) {
      if (v.severity !== "error" || !v.employeeId || !v.date) continue;
      const key = `${v.employeeId}|${v.date}`;
      const issue = { violation: violationIdentity(v), message: v.message };
      map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [view.violations]);

  /** Errors per day, limited to the displayed section. */
  const dayErrors = useMemo(() => {
    const map = new Map<string, View["violations"]>();
    for (const v of view.violations) {
      if (v.severity !== "error" || !v.date) continue;
      const vSection = v.employeeId
        ? index.employeeById.get(v.employeeId)?.sectionId
        : v.sectionId;
      if (sectionId && vSection !== sectionId) continue;
      map.set(v.date, [...(map.get(v.date) ?? []), v]);
    }
    return map;
  }, [view.violations, index, sectionId]);

  const monthTotals = useMemo(
    () => new Map(view.totals.map((t) => [t.employeeId, t.month])),
    [view.totals],
  );

  const colSpan = view.dates.length + 2;

  const fixingCell = useMemo(() => {
    if (!fixing) return null;
    const [employeeId, date] = fixing.split("|");
    const issues = errorCells.get(fixing);
    // The cell is no longer in error (fix applied): nothing left to show.
    if (!issues) return null;
    return {
      key: fixing,
      date,
      employee: view.employees.find((e) => e.id === employeeId),
      issues,
    };
  }, [fixing, errorCells, view.employees]);

  return (
    // The grid grows with the page (no inner vertical scrollbar); it only scrolls
    // sideways on narrow screens, keeping the name column visible.
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="sticky left-0 z-20 w-28 min-w-28 border-b bg-background px-2 py-1 text-left font-medium sm:w-auto sm:min-w-40">
              Employee
            </th>
            {view.dates.map((d) => {
              const errors = dayErrors.get(d.date);
              const label = (
                <>
                  <div className="text-[10px] text-muted-foreground">
                    {WEEKDAY_LETTERS[d.weekday - 1]}
                  </div>
                  <div>{d.day}</div>
                </>
              );
              return (
                <th
                  key={d.date}
                  title={d.holiday ?? undefined}
                  className={cn(
                    "min-w-7 border-b border-l p-0 text-center font-medium sm:min-w-8",
                    d.isWeekend && "bg-muted",
                    d.holiday && "bg-amber-200/70 dark:bg-amber-900/50",
                  )}
                >
                  {errors ? (
                    // Outlined in red: opens the summary of the day's errors.
                    <button
                      type="button"
                      onClick={() => setOpenDay(d.date)}
                      title={`${errors.length} error(s): show them`}
                      className="w-full cursor-pointer px-0.5 py-1 ring-2 ring-red-500 ring-inset outline-none hover:bg-red-500/10 focus-visible:bg-red-500/10"
                    >
                      {label}
                    </button>
                  ) : (
                    <div className="px-0.5 py-1">{label}</div>
                  )}
                </th>
              );
            })}
            <th className="border-b border-l px-2 py-1 text-right font-medium">
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, i) => {
            const employees = view.employees.filter(
              (e) => e.sectionId === section.id,
            );
            return (
              <Fragment key={section.id}>
                {i > 0 && (
                  // Breathing space between two sections.
                  <tr aria-hidden>
                    <td colSpan={colSpan} className="h-6 p-0" />
                  </tr>
                )}
                <tr>
                  <td colSpan={colSpan} className="border-y bg-muted/60 p-0">
                    {/* Centered in the visible part of the grid, even while it
                        scrolls sideways. */}
                    <span className="sticky left-1/2 inline-block -translate-x-1/2 px-3 py-2 text-base font-semibold tracking-wide">
                      {section.name}
                    </span>
                  </td>
                </tr>
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="px-2 py-2 text-muted-foreground"
                    >
                      No active employees.
                    </td>
                  </tr>
                )}
                {employees.map((employee) => {
                  const total = monthTotals.get(employee.id);
                  return (
                    <tr key={employee.id} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-[5] border-b bg-background px-2 py-0.5 whitespace-nowrap">
                        <div className="flex max-w-28 items-center gap-1.5 sm:max-w-none">
                          <Link
                            href={`/employees/${employee.id}`}
                            className="truncate hover:underline"
                            title={employee.name}
                          >
                            {employee.name}
                          </Link>
                          {employee.toConfirm && (
                            <span
                              className="size-2 shrink-0 rounded-full bg-amber-500"
                              title="Data to confirm"
                            />
                          )}
                        </div>
                      </td>
                      {view.dates.map((d) => {
                        const cell = view.cells[employee.id]?.[d.date];
                        const key = `${employee.id}|${d.date}`;
                        const issues = errorCells.get(key);
                        const fixable = canPlan && !!issues && !!view.schedule;
                        const box = (
                          <CellBox
                            cell={cell}
                            index={index}
                            errors={issues?.map((x) => x.message)}
                            weekend={d.isWeekend}
                            interactive={canEdit || fixable}
                            onClick={(event) => {
                              if (!fixable) return;
                              // Opens the fix suggestions instead of the editor.
                              event.preventDefault();
                              setFixing(key);
                            }}
                          />
                        );
                        return (
                          <td
                            key={d.date}
                            className={cn(
                              "border-b border-l p-0",
                              d.isWeekend && "bg-muted/50",
                              d.holiday &&
                                "bg-amber-100/60 dark:bg-amber-900/30",
                            )}
                          >
                            {canEdit && view.schedule ? (
                              <CellEditor
                                view={view}
                                scheduleId={view.schedule.id}
                                employee={employee as ViewEmployee}
                                date={d.date}
                                cell={cell}
                                open={editing === key}
                                onOpenChange={(open) =>
                                  setEditing(open ? key : null)
                                }
                              >
                                {box}
                              </CellEditor>
                            ) : (
                              box
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={cn(
                          "border-b border-l px-2 text-right font-mono whitespace-nowrap",
                          total && total.deltaMinutes < 0 && "text-destructive",
                        )}
                        title={
                          total
                            ? `Worked ${formatHoursMinutes(total.workedMinutes)}, credited ${formatHoursMinutes(total.creditedMinutes)}, expected ${formatHoursMinutes(total.expectedMinutes)}${total.unassignedDays ? `, ${total.unassignedDays} empty day(s)` : ""}`
                            : undefined
                        }
                      >
                        {total
                          ? formatHoursMinutes(total.deltaMinutes, true)
                          : ""}
                        {total?.unassignedDays ? "*" : ""}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {openDay && (
        <DayErrorsDialog
          open
          onOpenChange={(open) => {
            if (!open) setOpenDay(null);
          }}
          title={`${WEEKDAY_NAMES[(view.dates.find((d) => d.date === openDay)?.weekday ?? 1) - 1]} ${formatDayMonth(openDay)}`}
          violations={dayErrors.get(openDay) ?? []}
          view={view}
          index={index}
          canPlan={canPlan}
          canEdit={canEdit}
        />
      )}
      {fixingCell && view.schedule && (
        <CellFixDialog
          open
          onOpenChange={(open) => {
            if (!open) setFixing(null);
          }}
          title={`${fixingCell.employee?.name ?? ""} · ${formatDayMonth(fixingCell.date)}`}
          issues={fixingCell.issues}
          scheduleId={view.schedule.id}
          scheduleStatus={view.schedule.status}
          editable={canEdit}
          canApplyToPublished={
            view.schedule.status === "published" &&
            view.schedule.closedAt === null
          }
          onEditByHand={
            canEdit
              ? () => {
                  setFixing(null);
                  setEditing(fixingCell.key);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** A grid cell. Extra props are forwarded so it can be a Popover trigger. */
function CellBox({
  cell,
  index,
  errors,
  weekend,
  interactive,
  ...buttonProps
}: {
  cell: ViewCell | undefined;
  index: ViewIndex;
  errors?: string[];
  weekend: boolean;
  interactive: boolean;
} & ComponentProps<"button">) {
  const shift = cell?.shiftTypeId
    ? index.shiftById.get(cell.shiftTypeId)
    : undefined;
  const dayCode = cell?.dayCode
    ? index.dayCodeByCode.get(cell.dayCode)
    : undefined;
  const color = shift?.color ?? dayCode?.color;
  const label = shift?.code ?? dayCode?.code ?? "";
  const title = [
    shift
      ? `${shift.label}`
      : dayCode
        ? `${dayCode.code} — ${dayCode.label}`
        : "Empty",
    cell?.isLocked ? "Locked" : null,
    cell?.note ? `Note: ${cell.note}` : null,
    ...(errors ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      {...buttonProps}
      disabled={!interactive}
      title={title}
      className={cn(
        "relative flex h-7 w-full min-w-7 items-center sm:min-w-8 justify-center font-semibold outline-none",
        interactive &&
          "cursor-pointer hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring",
        !interactive && "cursor-default",
        errors && "ring-2 ring-red-500 ring-inset",
        !color && weekend && "bg-transparent",
      )}
      style={
        color
          ? { backgroundColor: color, color: readableTextColor(color) }
          : undefined
      }
      aria-label={title.replaceAll("\n", ", ")}
    >
      {label}
      {cell?.isLocked && (
        <Lock className="absolute top-0.5 right-0.5 size-2 opacity-70" />
      )}
      {cell?.note && (
        <span className="absolute bottom-0.5 left-0.5 size-1 rounded-full bg-current opacity-70" />
      )}
    </button>
  );
}
