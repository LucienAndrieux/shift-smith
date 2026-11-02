"use client";

import { Pencil, Plus } from "lucide-react";
import { useWatch } from "react-hook-form";
import { ConfirmButton } from "@/components/confirm-button";
import {
  CheckboxField,
  type Option,
  SelectField,
  TextareaField,
} from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { WEEKDAY_SHORT } from "@/lib/domain/calendar";
import {
  staffingOverrideSchema,
  staffingRequirementSchema,
} from "@/lib/schemas/reference";
import {
  createOverride,
  createRequirement,
  deleteOverride,
  deleteRequirement,
  updateOverride,
  updateRequirement,
} from "./actions";

export interface ShiftOption extends Option {
  sectionId: string;
}

function useWeekdayOptions(): Option[] {
  return WEEKDAY_SHORT[useLocale()].map((d, i) => ({
    value: String(i + 1),
    label: d,
  }));
}

const str = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

export interface RequirementInitial {
  id: string;
  sectionId: string;
  shiftTypeId: string | null;
  weekday: number | null;
  minStaff: number;
  maxStaff: number | null;
  validFrom: string | null;
  validTo: string | null;
  toConfirm: boolean;
  note: string | null;
}

export function RequirementDialog({
  sections,
  shifts,
  initial,
}: {
  sections: Option[];
  shifts: ShiftOption[];
  initial?: RequirementInitial;
}) {
  const t = useT();
  const st = t.staffing;
  const weekdays = useWeekdayOptions();
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label={st.edit}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> {st.addRequirement}
          </Button>
        )
      }
      title={initial ? st.editRequirement : st.newRequirement}
      description={st.requirementText}
      schema={staffingRequirementSchema}
      defaultValues={{
        sectionId: initial?.sectionId ?? sections[0]?.value ?? "",
        shiftTypeId: initial?.shiftTypeId ?? "",
        weekday: str(initial?.weekday),
        minStaff: String(initial?.minStaff ?? 1),
        maxStaff: str(initial?.maxStaff),
        validFrom: initial?.validFrom ?? "",
        validTo: initial?.validTo ?? "",
        toConfirm: initial?.toConfirm ?? false,
        note: initial?.note ?? "",
      }}
      action={(values) =>
        initial
          ? updateRequirement({ ...values, id: initial.id })
          : createRequirement(values)
      }
    >
      {(form) => (
        <>
          <SectionAndShift form={form} sections={sections} shifts={shifts} />
          <SelectField
            control={form.control}
            name="weekday"
            label={st.weekday}
            options={weekdays}
            noneLabel={st.everyDay}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="minStaff"
              label={st.minimum}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="maxStaff"
              label={st.maximum}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="validFrom"
              label={st.validFrom}
              type="date"
            />
            <TextField
              control={form.control}
              name="validTo"
              label={st.validTo}
              type="date"
            />
          </div>
          <CheckboxField
            control={form.control}
            name="toConfirm"
            label={t.common.toConfirm}
          />
          <TextareaField
            control={form.control}
            name="note"
            label={st.note}
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}

export interface OverrideInitial {
  id: string;
  sectionId: string;
  shiftTypeId: string | null;
  date: string;
  minStaff: number;
  maxStaff: number | null;
  reason: string | null;
}

export function OverrideDialog({
  sections,
  shifts,
  initial,
}: {
  sections: Option[];
  shifts: ShiftOption[];
  initial?: OverrideInitial;
}) {
  const { staffing: st } = useT();
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label={st.edit}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus /> {st.addOverride}
          </Button>
        )
      }
      title={initial ? st.editOverride : st.newOverride}
      description={st.overrideText}
      schema={staffingOverrideSchema}
      defaultValues={{
        sectionId: initial?.sectionId ?? sections[0]?.value ?? "",
        shiftTypeId: initial?.shiftTypeId ?? "",
        date: initial?.date ?? "",
        minStaff: String(initial?.minStaff ?? 1),
        maxStaff: str(initial?.maxStaff),
        reason: initial?.reason ?? "",
      }}
      action={(values) =>
        initial
          ? updateOverride({ ...values, id: initial.id })
          : createOverride(values)
      }
    >
      {(form) => (
        <>
          <SectionAndShift form={form} sections={sections} shifts={shifts} />
          <TextField
            control={form.control}
            name="date"
            label={st.date}
            type="date"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="minStaff"
              label={st.minimum}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="maxStaff"
              label={st.maximum}
              inputMode="numeric"
            />
          </div>
          <TextField control={form.control} name="reason" label={st.reason} />
        </>
      )}
    </FormDialog>
  );
}

/** Section select plus a shift select limited to that section's shifts. */
function SectionAndShift({
  form,
  sections,
  shifts,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: shared by two form shapes with these fields
  form: any;
  sections: Option[];
  shifts: ShiftOption[];
}) {
  const { staffing: st } = useT();
  const sectionId = useWatch({
    control: form.control,
    name: "sectionId",
  }) as string;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        control={form.control}
        name="sectionId"
        label={st.section}
        options={sections}
      />
      <SelectField
        control={form.control}
        name="shiftTypeId"
        label={st.shift}
        options={shifts.filter((s) => s.sectionId === sectionId)}
        noneLabel={st.anyShift}
      />
    </div>
  );
}

export function DeleteRequirementButton({ id }: { id: string }) {
  const { staffing: st } = useT();
  return (
    <ConfirmButton
      title={st.deleteRequirement}
      action={() => deleteRequirement({ id })}
    />
  );
}

export function DeleteOverrideButton({ id }: { id: string }) {
  const { staffing: st } = useT();
  return (
    <ConfirmButton
      title={st.deleteOverride}
      action={() => deleteOverride({ id })}
    />
  );
}
