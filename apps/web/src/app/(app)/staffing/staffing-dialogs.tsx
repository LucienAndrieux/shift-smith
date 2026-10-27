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

const WEEKDAYS: Option[] = WEEKDAY_SHORT.map((d, i) => ({
  value: String(i + 1),
  label: d,
}));

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
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add requirement
          </Button>
        )
      }
      title={initial ? "Edit requirement" : "New staffing requirement"}
      description="Minimum (and optional maximum) staff for a section, shift and weekday."
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
            label="Weekday"
            options={WEEKDAYS}
            noneLabel="Every day"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="minStaff"
              label="Minimum"
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="maxStaff"
              label="Maximum"
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="validFrom"
              label="Valid from"
              type="date"
            />
            <TextField
              control={form.control}
              name="validTo"
              label="Valid to"
              type="date"
            />
          </div>
          <CheckboxField
            control={form.control}
            name="toConfirm"
            label="To confirm"
          />
          <TextareaField
            control={form.control}
            name="note"
            label="Note"
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
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus /> Add date override
          </Button>
        )
      }
      title={initial ? "Edit override" : "New date override"}
      description='Replaces the requirement of the same section and shift on one date, e.g. "Trade fair".'
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
            label="Date"
            type="date"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="minStaff"
              label="Minimum"
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="maxStaff"
              label="Maximum"
              inputMode="numeric"
            />
          </div>
          <TextField control={form.control} name="reason" label="Reason" />
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
  const sectionId = useWatch({
    control: form.control,
    name: "sectionId",
  }) as string;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        control={form.control}
        name="sectionId"
        label="Section"
        options={sections}
      />
      <SelectField
        control={form.control}
        name="shiftTypeId"
        label="Shift"
        options={shifts.filter((s) => s.sectionId === sectionId)}
        noneLabel="Any shift of the section"
      />
    </div>
  );
}

export function DeleteRequirementButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this requirement?"
      action={() => deleteRequirement({ id })}
    />
  );
}

export function DeleteOverrideButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this override?"
      action={() => deleteOverride({ id })}
    />
  );
}
