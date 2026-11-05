"use client";

import { Lock, Wand2 } from "lucide-react";
import Link from "next/link";
import { HoverCard } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { softCodeStyle } from "@/lib/colors";
import { formatDayMonth, WEEKDAY_NAMES } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { violationIdentity } from "@/lib/domain/validator";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { CellEditor, CellEditorForm } from "./cell-editor";
import { DayErrorsDialog } from "./day-errors-dialog";
import { CellFixDialog, type FixIssue } from "./fix-dialog";
import type { View, ViewCell, ViewEmployee, ViewIndex } from "./types";

export function MonthGrid({
  view,
  index,
  sectionId,
  canEdit,
  canPlan,
  ownEmployeeId = null,
}: {
  view: View;
  index: ViewIndex;
  /** null = all sections */
  sectionId: string | null;
  canEdit: boolean;
  /** Manager: cells outlined in red open the fix suggestions. */
  canPlan: boolean;
  /** Employee guest: their row is highlighted. */
  ownEmployeeId?: string | null;
}) {
  const t = useT();
  const g = t.grid;
  const locale = useLocale();
  /** Cell (`employeeId|date`) whose editor or fix dialog is open. */
  const [editing, setEditing] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  /** Day whose error summary is open. */
  const [openDay, setOpenDay] = useState<string | null>(null);

  const sections = view.sections.filter(
    (s) => !sectionId || s.id === sectionId,
  );

  // Errors outlined in red (cells, day headers) belong to the planning view:
  // managers only.
  const errorCells = useMemo(() => {
    const map = new Map<string, FixIssue[]>();
    if (!canPlan) return map;
    for (const v of view.violations) {
      if (v.severity !== "error" || !v.employeeId || !v.date) continue;
      const key = `${v.employeeId}|${v.date}`;
      const issue = { violation: violationIdentity(v), message: v.message };
      map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [view.violations, canPlan]);

  /** Errors per day, limited to the displayed section. */
  const dayErrors = useMemo(() => {
    const map = new Map<string, View["violations"]>();
    if (!canPlan) return map;
    for (const v of view.violations) {
      if (v.severity !== "error" || !v.date) continue;
      const vSection = v.employeeId
        ? index.employeeById.get(v.employeeId)?.sectionId
        : v.sectionId;
      if (sectionId && vSection !== sectionId) continue;
      map.set(v.date, [...(map.get(v.date) ?? []), v]);
    }
    return map;
  }, [view.violations, index, sectionId, canPlan]);

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
    // sideways on narrow screens, keeping the name column visible. Same look as
    // the start page's preview: separate rounded cells, no gridlines.
    <div className="overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr>
            <th className="sticky left-0 z-20 w-28 min-w-28 bg-card px-2 py-1 text-left font-medium sm:w-auto sm:min-w-40">
              {g.employee}
            </th>
            {view.dates.map((d) => {
              const errors = dayErrors.get(d.date);
              const label = (
                <>
                  <div className="text-[10px] text-muted-foreground">
                    {g.weekdayLetters[d.weekday - 1]}
                  </div>
                  <div>{d.day}</div>
                </>
              );
              return (
                <th
                  key={d.date}
                  title={d.holiday ?? undefined}
                  className={cn(
                    "min-w-7 rounded-md p-0 text-center font-medium sm:min-w-8",
                    d.isWeekend && "bg-muted",
                    d.holiday && "bg-amber-200/70 dark:bg-amber-900/50",
                  )}
                >
                  {errors ? (
                    // Outlined in red: opens the summary of the day's errors.
                    <button
                      type="button"
                      onClick={() => setOpenDay(d.date)}
                      title={g.dayErrors(errors.length)}
                      className="w-full cursor-pointer rounded-md px-0.5 py-1 ring-2 ring-red-500 ring-inset outline-none hover:bg-red-500/10 focus-visible:bg-red-500/10"
                    >
                      {label}
                    </button>
                  ) : (
                    <div className="px-0.5 py-1">{label}</div>
                  )}
                </th>
              );
            })}
            <th className="px-2 py-1 text-right font-medium">Δ</th>
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
                  <td colSpan={colSpan} className="rounded-md bg-muted/60 p-0">
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
                      {g.noEmployees}
                    </td>
                  </tr>
                )}
                {employees.map((employee) => {
                  const total = monthTotals.get(employee.id);
                  const own = employee.id === ownEmployeeId;
                  // Playing an employee: their row stays in full colour, the
                  // others step back (back to full on hover). On the contents,
                  // not the row: the sticky name cell must stay opaque.
                  const dim =
                    !!ownEmployeeId &&
                    !own &&
                    "opacity-35 transition-opacity group-hover:opacity-100";
                  return (
                    <tr
                      key={employee.id}
                      className={cn(
                        "group hover:bg-muted/30",
                        own && "font-semibold",
                      )}
                    >
                      <td className="sticky left-0 z-[5] rounded-md bg-card px-2 py-0.5 whitespace-nowrap">
                        <div
                          className={cn(
                            "flex max-w-28 items-center gap-1.5 sm:max-w-none",
                            dim,
                          )}
                        >
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
                              title={t.employees.dataToConfirm}
                            />
                          )}
                        </div>
                      </td>
                      {view.dates.map((d) => {
                        const cell = view.cells[employee.id]?.[d.date];
                        const key = `${employee.id}|${d.date}`;
                        const issues = errorCells.get(key);
                        const fixable = canPlan && !!issues && !!view.schedule;
                        const errors = issues?.map((x) => x.message);
                        const box = (
                          <CellBox
                            cell={cell}
                            index={index}
                            t={g}
                            errors={errors}
                          />
                        );
                        return (
                          <td
                            key={d.date}
                            className={cn(
                              "rounded-md p-0",
                              d.isWeekend && "bg-muted/50",
                              d.holiday &&
                                "bg-amber-100/60 dark:bg-amber-900/30",
                              dim,
                            )}
                          >
                            <CellCard
                              view={view}
                              cell={cell}
                              index={index}
                              employee={employee as ViewEmployee}
                              date={d.date}
                              scheduleId={
                                canEdit && view.schedule
                                  ? view.schedule.id
                                  : null
                              }
                              errors={errors}
                              onSolve={
                                fixable ? () => setFixing(key) : undefined
                              }
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
                            </CellCard>
                          </td>
                        );
                      })}
                      <td
                        className={cn(
                          "rounded-md px-2 text-right font-mono whitespace-nowrap",
                          total && total.deltaMinutes < 0 && "text-destructive",
                          dim,
                        )}
                        title={
                          total
                            ? g.deltaTitle(
                                formatHoursMinutes(total.workedMinutes),
                                formatHoursMinutes(total.creditedMinutes),
                                formatHoursMinutes(total.expectedMinutes),
                                total.unassignedDays,
                              )
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
          title={`${WEEKDAY_NAMES[locale][(view.dates.find((d) => d.date === openDay)?.weekday ?? 1) - 1]} ${formatDayMonth(openDay, locale)}`}
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
          title={`${fixingCell.employee?.name ?? ""} · ${formatDayMonth(fixingCell.date, locale)}`}
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

/** A grid cell, the trigger of its hover card (and of the editor's popover). */
function CellBox({
  cell,
  index,
  t,
  errors,
  ...buttonProps
}: {
  cell: ViewCell | undefined;
  index: ViewIndex;
  t: Dictionary["grid"];
  errors?: string[];
} & ComponentProps<"button">) {
  const card = useContext(CellCardContext);
  const pointer = useRef<string>("mouse");
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
        : t.empty,
    cell?.isLocked ? t.locked : null,
    cell?.note ? t.note(cell.note) : null,
    ...(errors ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <HoverCard.Trigger asChild>
      <button
        type="button"
        {...buttonProps}
        onPointerDown={(event) => {
          pointer.current = event.pointerType;
          buttonProps.onPointerDown?.(event);
        }}
        onClick={(event) => {
          // A click never edits: the card (hover, or tap on touch screens)
          // holds the actions.
          event.preventDefault();
          if (pointer.current !== "mouse") card?.open();
          buttonProps.onClick?.(event);
        }}
        className={cn(
          "relative flex h-7 w-full min-w-7 cursor-default items-center justify-center rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-8",
          // Grows under the pointer and while its card is open; stays under the
          // sticky name column (z-5).
          "transition-[scale,box-shadow] duration-150 ease-out hover:z-[4] hover:scale-[1.18] hover:shadow-md motion-reduce:transition-none",
          card?.isOpen && "z-[4] scale-[1.18] shadow-md",
          errors && "ring-2 ring-red-500 ring-inset",
          // Empty days keep a faint tile so the grid stays readable without lines.
          !color && "bg-muted/60",
        )}
        style={color ? softCodeStyle(color) : undefined}
        aria-label={title.replaceAll("\n", ", ")}
      >
        {label}
        {cell?.isLocked && (
          <Lock
            strokeWidth={3}
            className="absolute top-px right-px size-2.5 text-black drop-shadow-[0_0_1px_white]"
          />
        )}
        {cell?.note && (
          <span className="absolute bottom-0.5 left-0.5 size-1 rounded-full bg-current opacity-70" />
        )}
      </button>
    </HoverCard.Trigger>
  );
}

/** The cell card currently open in the grid: only one at a time. */
const openCard: { hide: (() => void) | null } = { hide: null };

/** Lets a tap on a cell open its card (hover cards ignore touch). */
const CellCardContext = createContext<{
  open: () => void;
  isOpen: boolean;
} | null>(null);

/**
 * Hover card of a cell (a tap on touch screens): who and when, then for a
 * manager on an editable version the editor itself (code, solver lock, note,
 * Clear and Save), else the code, lock and note read-only; "Solve" on a cell in
 * error. Once used (a click or a key inside), it stays open until saved,
 * dismissed (Escape, a click outside) or solved.
 */
function CellCard({
  view,
  cell,
  index,
  employee,
  date,
  scheduleId,
  errors,
  onSolve,
  children,
}: {
  view: View;
  cell: ViewCell | undefined;
  index: ViewIndex;
  employee: ViewEmployee;
  date: string;
  /** Set when this user may edit the displayed version. */
  scheduleId: string | null;
  errors?: string[];
  /** Set when the cell is in error and the user may fix it. */
  onSolve?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  // Used: hovering away no longer closes it (a select menu, typing a note).
  const pinned = useRef(false);
  // Stable for the life of the card: the grid-wide open card points at it.
  const hide = useRef(() => {
    pinned.current = false;
    setOpen(false);
  }).current;
  const close = () => {
    hide();
    if (openCard.hide === hide) openCard.hide = null;
  };
  // One card at a time: opening this one closes the other (even a used one).
  const show = () => {
    if (openCard.hide && openCard.hide !== hide) openCard.hide();
    openCard.hide = hide;
    pinned.current = false;
    setOpen(true);
  };
  useEffect(
    () => () => {
      if (openCard.hide === hide) openCard.hide = null;
    },
    [hide],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: show only uses refs and setters
  const context = useMemo(() => ({ open: show, isOpen: open }), [open]);
  const shift = cell?.shiftTypeId
    ? index.shiftById.get(cell.shiftTypeId)
    : undefined;
  const dayCode = cell?.dayCode
    ? index.dayCodeByCode.get(cell.dayCode)
    : undefined;
  const color = shift?.color ?? dayCode?.color;

  return (
    <CellCardContext value={context}>
      <HoverCard.Root
        open={open}
        onOpenChange={(next) => {
          if (next) show();
          else if (!pinned.current) close();
        }}
        openDelay={60}
        closeDelay={80}
      >
        {children}
        <HoverCard.Portal>
          <HoverCard.Content
            side="top"
            sideOffset={6}
            collisionPadding={12}
            onPointerDownCapture={() => {
              pinned.current = true;
            }}
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape") pinned.current = true;
            }}
            onEscapeKeyDown={close}
            onPointerDownOutside={(event) => {
              // The code menu opens outside the card: picking in it keeps it.
              const target = event.target as Element | null;
              if (target?.closest("[data-radix-popper-content-wrapper]")) {
                event.preventDefault();
                return;
              }
              close();
            }}
            className="z-50 flex w-72 max-w-[calc(100vw-2rem)] origin-(--radix-hover-card-content-transform-origin) flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-50 data-[state=open]:duration-150 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-50 data-[state=closed]:duration-100 data-[state=closed]:ease-in"
          >
            <div className="text-sm font-semibold">
              {employee.name} · {formatDayMonth(date, locale)}
            </div>
            {scheduleId ? (
              <CellEditorForm
                view={view}
                scheduleId={scheduleId}
                employee={employee}
                date={date}
                cell={cell}
                onDone={close}
              />
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs">
                  {color && (
                    <span
                      className="inline-flex min-w-7 shrink-0 justify-center rounded px-1 font-bold"
                      style={softCodeStyle(color)}
                    >
                      {shift?.code ?? dayCode?.code}
                    </span>
                  )}
                  <div className="min-w-0">
                    {shift ? (
                      <>
                        <div className="font-medium">{shift.hours}</div>
                        <div className="text-muted-foreground">
                          {formatHoursMinutes(shift.paidMinutes)}
                        </div>
                      </>
                    ) : (
                      <div className="font-medium">
                        {dayCode ? dayCode.label : t.grid.empty}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Lock className="size-3.5" />
                  <span className="flex-1">{t.cellEditor.locked}</span>
                  <Switch
                    aria-label={t.cellEditor.locked}
                    checked={cell?.isLocked ?? false}
                    disabled
                  />
                </div>
                {cell?.note && (
                  <div className="rounded-lg border px-2.5 py-2 text-xs whitespace-pre-line text-muted-foreground">
                    {cell.note}
                  </div>
                )}
              </>
            )}
            {errors && errors.length > 0 && (
              <ul className="flex flex-col gap-1 border-t pt-2.5 text-xs text-destructive">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {onSolve && (
              <Button
                size="sm"
                className="self-end"
                onClick={() => {
                  close();
                  onSolve();
                }}
              >
                <Wand2 /> {t.grid.solve}
              </Button>
            )}
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </CellCardContext>
  );
}
