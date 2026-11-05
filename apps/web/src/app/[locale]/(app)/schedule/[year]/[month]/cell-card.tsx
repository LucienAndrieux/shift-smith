"use client";

import { Lock, Wand2 } from "lucide-react";
import { Popover } from "radix-ui";
import {
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { softCodeStyle } from "@/lib/colors";
import { formatDayMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { CellEditorForm } from "./cell-editor";
import type { View, ViewEmployee, ViewIndex } from "./types";

const OPEN_DELAY = 60;
const CLOSE_DELAY = 80;

export interface CellCardHandle {
  /** Opens the card of a cell (`employeeId|date`), e.g. "Edit the cell by hand". */
  open: (key: string) => void;
}

/**
 * The one card of the month grid, shared by every cell: hovering a cell (a tap
 * on touch screens) shows it next to that cell. It holds who and when, then for
 * a manager on an editable version the editor (code, solver lock, note, Clear,
 * Save), else the code, lock and note read-only; "Solve" on a cell in error.
 * Once used (a click or a key inside) it stays open until saved, dismissed
 * (Escape, a click outside), solved or replaced by another cell's card.
 *
 * One card instead of one per cell keeps the grid light to render; the hover
 * state lives here, so hovering never re-renders the grid.
 */
export function CellCard({
  ref,
  tableRef,
  view,
  index,
  scheduleId,
  errorsOf,
  onSolve,
}: {
  ref: RefObject<CellCardHandle | null>;
  /** The grid's table: cells are its `[data-cell]` buttons. */
  tableRef: RefObject<HTMLTableElement | null>;
  view: View;
  index: ViewIndex;
  /** Set when this user may edit the displayed version. */
  scheduleId: string | null;
  /** Error messages of a cell, and whether this user may fix them. */
  errorsOf: (key: string) => { messages: string[]; fixable: boolean } | null;
  onSolve: (key: string) => void;
}) {
  const [key, setKey] = useState<string | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cellElement = useCallback(
    (cellKey: string) =>
      tableRef.current?.querySelector<HTMLElement>(
        `[data-cell="${CSS.escape(cellKey)}"]`,
      ) ?? null,
    [tableRef],
  );

  const show = useCallback((cellKey: string, element: HTMLElement | null) => {
    clearTimeout(timer.current);
    if (!element) return;
    anchor.current?.removeAttribute("data-active");
    anchor.current = element;
    element.setAttribute("data-active", "true");
    pinned.current = false;
    setKey(cellKey);
  }, []);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    anchor.current?.removeAttribute("data-active");
    pinned.current = false;
    setKey(null);
  }, []);

  /** Closes after a short delay, unless the card is in use. */
  const closeSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!pinned.current) close();
    }, CLOSE_DELAY);
  }, [close]);

  // Opened from elsewhere (the Fix dialog): the dialog closing uncovers some
  // other cell under the pointer, which must not take the card over before the
  // pointer actually moves.
  const holdHover = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      open: (cellKey) => {
        show(cellKey, cellElement(cellKey));
        pinned.current = true;
        holdHover.current = true;
        document.addEventListener(
          "pointermove",
          () => {
            holdHover.current = false;
          },
          { once: true },
        );
      },
    }),
    [show, cellElement],
  );

  // Hover and tap, delegated to the table: no listener per cell.
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let pointerType = "mouse";
    const cellOf = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-cell]")
        : null;

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch" || holdHover.current) return;
      const cell = cellOf(event.target);
      if (!cell) return;
      const cellKey = cell.dataset.cell as string;
      clearTimeout(timer.current);
      if (cell === anchor.current) return;
      timer.current = setTimeout(() => show(cellKey, cell), OPEN_DELAY);
    };
    const onOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const cell = cellOf(event.target);
      if (!cell || cell.contains(event.relatedTarget as Node | null)) return;
      if (cell === anchor.current) closeSoon();
      else clearTimeout(timer.current);
    };
    const onDown = (event: PointerEvent) => {
      pointerType = event.pointerType;
    };
    // A click never edits: the card holds the actions. A tap opens it.
    const onClick = (event: MouseEvent) => {
      const cell = cellOf(event.target);
      if (!cell) return;
      event.preventDefault();
      if (pointerType !== "mouse") show(cell.dataset.cell as string, cell);
    };
    table.addEventListener("pointerover", onOver);
    table.addEventListener("pointerout", onOut);
    table.addEventListener("pointerdown", onDown);
    table.addEventListener("click", onClick);
    return () => {
      table.removeEventListener("pointerover", onOver);
      table.removeEventListener("pointerout", onOut);
      table.removeEventListener("pointerdown", onDown);
      table.removeEventListener("click", onClick);
      clearTimeout(timer.current);
    };
  }, [tableRef, show, closeSoon]);

  const [employeeId, date] = key ? key.split("|") : [];
  const employee = employeeId
    ? (index.employeeById.get(employeeId) as ViewEmployee | undefined)
    : undefined;

  return (
    <Popover.Root
      open={!!key && !!employee}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Popover.Anchor virtualRef={anchor as RefObject<HTMLElement>} />
      <Popover.Portal>
        {key && employee && (
          <Popover.Content
            // A new cell: a new card (fresh editor, opening animation).
            key={key}
            side="top"
            sideOffset={6}
            collisionPadding={12}
            // Hovering must not move the focus away from the page.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") closeSoon();
            }}
            onPointerDownCapture={() => {
              pinned.current = true;
            }}
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape") pinned.current = true;
            }}
            onPointerDownOutside={(event) => {
              // The code menu opens outside the card: picking in it keeps it.
              const target = event.target as Element | null;
              if (target?.closest("[data-radix-popper-content-wrapper]"))
                event.preventDefault();
            }}
            className="z-50 flex w-72 max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-50 data-[state=open]:duration-150 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-50 data-[state=closed]:duration-100 data-[state=closed]:ease-in"
          >
            <CardBody
              view={view}
              index={index}
              employee={employee}
              date={date}
              scheduleId={scheduleId}
              errors={errorsOf(key)}
              onDone={close}
              onSolve={() => {
                close();
                onSolve(key);
              }}
            />
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
}

function CardBody({
  view,
  index,
  employee,
  date,
  scheduleId,
  errors,
  onDone,
  onSolve,
}: {
  view: View;
  index: ViewIndex;
  employee: ViewEmployee;
  date: string;
  scheduleId: string | null;
  errors: { messages: string[]; fixable: boolean } | null;
  onDone: () => void;
  onSolve: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const cell = view.cells[employee.id]?.[date];
  const shift = cell?.shiftTypeId
    ? index.shiftById.get(cell.shiftTypeId)
    : undefined;
  const dayCode = cell?.dayCode
    ? index.dayCodeByCode.get(cell.dayCode)
    : undefined;
  const color = shift?.color ?? dayCode?.color;

  return (
    <>
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
          onDone={onDone}
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
      {errors && errors.messages.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-2.5 text-xs text-destructive">
          {errors.messages.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {errors?.fixable && (
        <Button size="sm" className="self-end" onClick={onSolve}>
          <Wand2 /> {t.grid.solve}
        </Button>
      )}
    </>
  );
}
