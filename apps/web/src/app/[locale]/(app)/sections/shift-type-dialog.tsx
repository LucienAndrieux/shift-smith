"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  type Control,
  type UseFormReturn,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import type { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { CheckboxField, TextareaField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { computeShiftDuration } from "@/lib/domain/durations";
import {
  formatHoursMinutes,
  formatTimeOfDay,
  parseTimeOfDay,
} from "@/lib/domain/time";
import {
  type ShiftTypeFormValues,
  shiftTypeSchema,
} from "@/lib/schemas/reference";
import { createShiftType, deleteShiftType, updateShiftType } from "./actions";

export interface ShiftTypeInitial {
  id: string;
  sectionId: string;
  code: string;
  label: string;
  color: string;
  isActive: boolean;
  toConfirm: boolean;
  notes: string | null;
  periods: {
    startMinute: number;
    endMinute: number;
    unpaidBreakMinutes: number;
  }[];
}

export function ShiftTypeDialog({
  sectionId,
  shift,
}: {
  sectionId: string;
  shift?: ShiftTypeInitial;
}) {
  const t = useT();
  const se = t.sections;
  const defaults: ShiftTypeFormValues = {
    sectionId,
    code: shift?.code ?? "",
    label: shift?.label ?? "",
    color: shift?.color ?? "#3b82f6",
    isActive: shift?.isActive ?? true,
    toConfirm: shift?.toConfirm ?? false,
    notes: shift?.notes ?? "",
    periods: (
      shift?.periods ?? [
        { startMinute: 480, endMinute: 960, unpaidBreakMinutes: 0 },
      ]
    ).map((p) => ({
      start: formatTimeOfDay(p.startMinute),
      end: formatTimeOfDay(p.endMinute),
      unpaidBreakMinutes: String(p.unpaidBreakMinutes),
    })),
  };

  return (
    <FormDialog
      wide
      trigger={
        shift ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={se.editShift(shift.code)}
          >
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> {se.addShift}
          </Button>
        )
      }
      title={shift ? se.editShift(shift.code) : se.newShift}
      description={se.shiftText}
      schema={shiftTypeSchema}
      defaultValues={defaults}
      action={(values) =>
        shift
          ? updateShiftType({ ...values, id: shift.id })
          : createShiftType(values)
      }
      successMessage={shift ? se.shiftUpdated : se.shiftCreated}
    >
      {(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr_8rem]">
            <TextField
              control={form.control}
              name="code"
              label={se.code}
              maxLength={1}
            />
            <TextField control={form.control} name="label" label={se.label} />
            <TextField
              control={form.control}
              name="color"
              label={se.colour}
              type="color"
            />
          </div>
          <PeriodsEditor form={form} />
          <div className="flex flex-wrap gap-6">
            <CheckboxField
              control={form.control}
              name="isActive"
              label={se.active}
            />
            <CheckboxField
              control={form.control}
              name="toConfirm"
              label={t.common.toConfirm}
            />
          </div>
          <TextareaField
            control={form.control}
            name="notes"
            label={se.notes}
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}

type ShiftForm = UseFormReturn<
  ShiftTypeFormValues & Record<string, unknown>,
  unknown,
  z.output<typeof shiftTypeSchema> & Record<string, unknown>
>;

function PeriodsEditor({ form }: { form: ShiftForm }) {
  // The form type is widened with Record<string, unknown>; narrow it for the array API.
  const { sections: se } = useT();
  const control = form.control as unknown as Control<ShiftTypeFormValues>;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "periods",
  });
  const periods = useWatch({ control, name: "periods" });
  const paid = livePaidMinutes(periods);
  const rootError =
    form.formState.errors.periods?.root ?? form.formState.errors.periods;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabel>{se.periods}</FieldLabel>
        <span className="text-sm">
          {se.paid}{" "}
          <strong className="font-mono">
            {paid === null ? "—" : formatHoursMinutes(paid)}
          </strong>
        </span>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"
        >
          <TextField
            control={form.control}
            name={`periods.${index}.start`}
            label={se.start}
            placeholder="08:00"
          />
          <TextField
            control={form.control}
            name={`periods.${index}.end`}
            label={se.end}
            placeholder="12:30"
          />
          <TextField
            control={form.control}
            name={`periods.${index}.unpaidBreakMinutes`}
            label={se.unpaidBreak}
            inputMode="numeric"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={se.removePeriod}
            disabled={fields.length === 1}
            onClick={() => remove(index)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {typeof rootError?.message === "string" && (
        <FieldError>{rootError.message}</FieldError>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={fields.length >= 6}
        onClick={() => append({ start: "", end: "", unpaidBreakMinutes: "0" })}
      >
        <Plus /> {se.addPeriod}
      </Button>
    </div>
  );
}

function livePaidMinutes(periods: ShiftTypeFormValues["periods"] | undefined) {
  if (!periods) return null;
  try {
    return computeShiftDuration(
      periods.map((p) => ({
        startMinute: parseTimeOfDay(p.start),
        endMinute: parseTimeOfDay(p.end),
        unpaidBreakMinutes: Number(p.unpaidBreakMinutes) || 0,
      })),
    ).paidMinutes;
  } catch {
    return null;
  }
}

export function DeleteShiftTypeButton({
  id,
  code,
}: {
  id: string;
  code: string;
}) {
  const { sections: se } = useT();
  return (
    <ConfirmButton
      title={se.deleteShift(code)}
      description={se.deleteShiftText}
      action={() => deleteShiftType({ id })}
    />
  );
}
