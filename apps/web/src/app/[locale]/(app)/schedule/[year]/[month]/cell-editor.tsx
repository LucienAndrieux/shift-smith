"use client";

import { Lock } from "lucide-react";
import { useId, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatHours } from "@/lib/domain/time";
import { encodeCellValue } from "@/lib/schemas/schedule";
import { setCell } from "../../actions";
import type { View, ViewCell, ViewEmployee } from "./types";

const EMPTY = "__empty__";

/**
 * Code, solver lock and note of one cell, with Clear and Save. Starts from the
 * cell each time it mounts (the cell card opens).
 */
export function CellEditorForm({
  view,
  scheduleId,
  employee,
  date,
  cell,
  onDone,
}: {
  view: View;
  scheduleId: string;
  employee: ViewEmployee;
  date: string;
  cell: ViewCell | undefined;
  /** After a successful save or clear. */
  onDone: () => void;
}) {
  const t = useT();
  const c = t.cellEditor;
  const lockId = useId();
  const [value, setValue] = useState(cell ? encodeCellValue(cell) : "");
  const [isLocked, setIsLocked] = useState(cell?.isLocked ?? false);
  const [note, setNote] = useState(cell?.note ?? "");
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
    if (result.ok) onDone();
  }

  return (
    <>
      <Select
        value={value || EMPTY}
        onValueChange={(v) => setValue(v === EMPTY ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>— {t.grid.empty} —</SelectItem>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{c.eligible}</SelectLabel>
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
              <SelectLabel>{c.otherShifts}</SelectLabel>
              {sectionShifts.map((s) => (
                <SelectItem key={s.id} value={`s:${s.id}`}>
                  {s.code} · {s.hours}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{t.schedule.dayCodes}</SelectLabel>
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
          htmlFor={lockId}
          className="flex items-center gap-1.5 font-normal"
        >
          <Lock className="size-3.5" /> {c.locked}
        </Label>
        <Switch
          id={lockId}
          checked={isLocked}
          disabled={!value}
          onCheckedChange={setIsLocked}
        />
      </div>
      <Input
        placeholder={c.note}
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
          {c.clear}
        </Button>
        <Button size="sm" disabled={pending} onClick={() => save()}>
          {t.common.save}
        </Button>
      </div>
    </>
  );
}
