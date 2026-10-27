"use client";

import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import {
  type Option,
  SelectField,
  TextareaField,
} from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { WEEKDAY_SHORT } from "@/lib/domain/calendar";
import {
  eligibilitySchema,
  fixedDaysOffSchema,
  hourBankAdjustmentSchema,
  relationSchema,
  unavailabilitySchema,
} from "@/lib/schemas/reference";
import {
  addHourBankAdjustment,
  createRelation,
  createUnavailability,
  deleteEligibility,
  deleteRelation,
  deleteUnavailability,
  setFixedDaysOff,
  upsertEligibility,
} from "../actions";

const WEEKDAY_OPTIONS: Option[] = WEEKDAY_SHORT.map((d, i) => ({
  value: String(i + 1),
  label: d,
}));

export function FixedDaysOffDialog({
  employeeId,
  weekdays,
}: {
  employeeId: string;
  weekdays: number[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil /> Edit
        </Button>
      }
      title="Fixed days off"
      description="Weekly rest days, coded OF on the schedule."
      schema={fixedDaysOffSchema}
      defaultValues={{
        employeeId,
        first: weekdays[0] ? String(weekdays[0]) : "",
        second: weekdays[1] ? String(weekdays[1]) : "",
      }}
      action={setFixedDaysOff}
    >
      {(form) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="first"
            label="First rest day"
            options={WEEKDAY_OPTIONS}
            noneLabel="None"
          />
          <SelectField
            control={form.control}
            name="second"
            label="Second rest day"
            options={WEEKDAY_OPTIONS}
            noneLabel="None"
          />
        </div>
      )}
    </FormDialog>
  );
}

export interface EligibilityInitial {
  shiftTypeId: string;
  preference: "preferred" | "normal" | "rare";
  maxPerWeek: number | null;
  exactPerWeek: number | null;
  note: string | null;
}

export function EligibilityDialog({
  employeeId,
  shiftOptions,
  initial,
}: {
  employeeId: string;
  /** All shift types, any section (an employee may work in another section). */
  shiftOptions: Option[];
  initial?: EligibilityInitial;
}) {
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> Add shift
          </Button>
        )
      }
      title={initial ? "Edit shift eligibility" : "Add shift eligibility"}
      schema={eligibilitySchema}
      defaultValues={{
        employeeId,
        shiftTypeId: initial?.shiftTypeId ?? "",
        preference: initial?.preference ?? "normal",
        maxPerWeek: initial?.maxPerWeek?.toString() ?? "",
        exactPerWeek: initial?.exactPerWeek?.toString() ?? "",
        note: initial?.note ?? "",
      }}
      action={upsertEligibility}
    >
      {(form) => (
        <>
          <SelectField
            control={form.control}
            name="shiftTypeId"
            label="Shift"
            options={shiftOptions}
            disabled={Boolean(initial)}
          />
          <SelectField
            control={form.control}
            name="preference"
            label="Preference"
            options={[
              { value: "preferred", label: "Preferred" },
              { value: "normal", label: "Normal" },
              { value: "rare", label: "Rare" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="maxPerWeek"
              label="Max per week"
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="exactPerWeek"
              label="Exactly per week"
              inputMode="numeric"
            />
          </div>
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

export function DeleteEligibilityButton({
  employeeId,
  shiftTypeId,
  label,
}: {
  employeeId: string;
  shiftTypeId: string;
  label: string;
}) {
  return (
    <ConfirmButton
      title={`Remove ${label}?`}
      description="The employee will no longer be eligible for this shift."
      confirmLabel="Remove"
      successMessage="Shift removed"
      action={() => deleteEligibility({ employeeId, shiftTypeId })}
    />
  );
}

export function RelationDialog({
  employeeId,
  others,
}: {
  employeeId: string;
  others: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> Add relation
        </Button>
      }
      title="Add relation"
      schema={relationSchema}
      defaultValues={{
        employeeAId: employeeId,
        employeeBId: "",
        type: "same_days_off",
        note: "",
      }}
      action={createRelation}
    >
      {(form) => (
        <>
          <SelectField
            control={form.control}
            name="type"
            label="Rule"
            options={[
              {
                value: "same_days_off",
                label: "Same days off (e.g. a couple)",
              },
              {
                value: "different_weekend_off",
                label: "Must not have the same weekend off",
              },
            ]}
          />
          <SelectField
            control={form.control}
            name="employeeBId"
            label="With"
            options={others}
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

export function DeleteRelationButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this relation?"
      action={() => deleteRelation({ id })}
    />
  );
}

export function UnavailabilityDialog({ employeeId }: { employeeId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> Add unavailability
        </Button>
      }
      title="Add unavailability"
      description="Leave the times empty for the whole day."
      schema={unavailabilitySchema}
      defaultValues={{
        employeeId,
        date: "",
        startTime: "",
        endTime: "",
        reason: "",
      }}
      action={createUnavailability}
    >
      {(form) => (
        <>
          <TextField
            control={form.control}
            name="date"
            label="Date"
            type="date"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="startTime"
              label="From (HH:MM)"
              placeholder="08:00"
            />
            <TextField
              control={form.control}
              name="endTime"
              label="To (HH:MM)"
              placeholder="13:00"
            />
          </div>
          <TextField control={form.control} name="reason" label="Reason" />
        </>
      )}
    </FormDialog>
  );
}

export function DeleteUnavailabilityButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this unavailability?"
      action={() => deleteUnavailability({ id })}
    />
  );
}

export function HourBankAdjustmentDialog({
  employeeId,
  today,
}: {
  employeeId: string;
  today: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> Manual adjustment
        </Button>
      }
      title="Manual hour-bank adjustment"
      description="Positive hours are owed to the employee; negative hours are taken."
      schema={hourBankAdjustmentSchema}
      defaultValues={{ employeeId, entryDate: today, hours: "", note: "" }}
      action={addHourBankAdjustment}
      successMessage="Adjustment recorded"
    >
      {(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="entryDate"
              label="Date"
              type="date"
            />
            <TextField
              control={form.control}
              name="hours"
              label="Hours (signed)"
              placeholder="-7.6"
              inputMode="decimal"
            />
          </div>
          <TextareaField
            control={form.control}
            name="note"
            label="Reason"
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}
