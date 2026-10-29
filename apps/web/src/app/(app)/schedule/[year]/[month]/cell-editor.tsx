"use client";

import { Lock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { formatDayMonth } from "@/lib/domain/calendar";
import { formatHours } from "@/lib/domain/time";
import { encodeCellValue } from "@/lib/schemas/schedule";
import { setCell } from "../../actions";
import type { View, ViewCell, ViewEmployee } from "./types";

const EMPTY = "__empty__";

export function CellEditor({
  view,
  scheduleId,
  employee,
  date,
  cell,
  open,
  onOpenChange,
  children,
}: {
  view: View;
  scheduleId: string;
  employee: ViewEmployee;
  date: string;
  cell: ViewCell | undefined;
  /** Controlled by the grid, which can also open it from the Fix dialog. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [value, setValue] = useState(cell ? encodeCellValue(cell) : "");
  const [isLocked, setIsLocked] = useState(cell?.isLocked ?? false);
  const [note, setNote] = useState(cell?.note ?? "");
  // Every opening starts from the current cell.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(cell ? encodeCellValue(cell) : "");
      setIsLocked(cell?.isLocked ?? false);
      setNote(cell?.note ?? "");
    }
  }
  const { pending, run } = useAction();

  const eligible = view.shiftTypes.filter((s) =>
    employee.eligibleShiftIds.includes(s.id),
  );
  const sectionShifts = view.shiftTypes.filter(
    (s) =>
      s.sectionId === employee.sectionId &&
      !employee.eligibleShiftIds.includes(s.id),
  );
  const sectionName = (id: string) =>
    view.sections.find((s) => s.id === id)?.name ?? "";

  async function save(nextValue = value) {
    const result = await run(() =>
      setCell({
        scheduleId,
        employeeId: employee.id,
        date,
        value: nextValue,
        isLocked: nextValue ? isLocked : false,
        note,
      }),
    );
    if (result.ok) onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72" align="center">
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium">
            {employee.name} · {formatDayMonth(date)}
          </div>
          <Select
            value={value || EMPTY}
            onValueChange={(v) => setValue(v === EMPTY ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>— Empty —</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Eligible shifts</SelectLabel>
                {eligible.map((s) => (
                  <SelectItem key={s.id} value={`s:${s.id}`}>
                    {s.sectionId === employee.sectionId
                      ? ""
                      : `${sectionName(s.sectionId)} `}
                    {s.code} · {s.hours} ({formatHours(s.paidMinutes)})
                  </SelectItem>
                ))}
              </SelectGroup>
              {sectionShifts.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other shifts of the section</SelectLabel>
                  {sectionShifts.map((s) => (
                    <SelectItem key={s.id} value={`s:${s.id}`}>
                      {s.code} · {s.hours}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Day codes</SelectLabel>
                {view.dayCodes.map((d) => (
                  <SelectItem key={d.code} value={`d:${d.code}`}>
                    {d.code} · {d.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <Label
              htmlFor="cell-lock"
              className="flex items-center gap-1.5 font-normal"
            >
              <Lock className="size-3.5" /> Locked for the solver
            </Label>
            <Switch
              id="cell-lock"
              checked={isLocked}
              disabled={!value}
              onCheckedChange={setIsLocked}
            />
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || !cell}
              onClick={() => save("")}
            >
              Clear
            </Button>
            <Button size="sm" disabled={pending} onClick={() => save()}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
