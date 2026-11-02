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
import { useLocale, useT } from "@/components/i18n-provider";
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

function useWeekdayOptions(): Option[] {
  return WEEKDAY_SHORT[useLocale()].map((d, i) => ({
    value: String(i + 1),
    label: d,
  }));
}

export function FixedDaysOffDialog({
  employeeId,
  weekdays,
}: {
  employeeId: string;
  weekdays: number[];
}) {
  const t = useT();
  const x = t.editors;
  const weekdayOptions = useWeekdayOptions();
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil /> {x.edit}
        </Button>
      }
      title={t.employees.fixedDaysOff}
      description={x.daysOffText}
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
            label={x.firstRestDay}
            options={weekdayOptions}
            noneLabel={x.none}
          />
          <SelectField
            control={form.control}
            name="second"
            label={x.secondRestDay}
            options={weekdayOptions}
            noneLabel={x.none}
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
  const t = useT();
  const x = t.editors;
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label={x.edit}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> {x.addShift}
          </Button>
        )
      }
      title={initial ? x.editEligibility : x.addEligibility}
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
            label={t.profile.shift}
            options={shiftOptions}
            disabled={Boolean(initial)}
          />
          <SelectField
            control={form.control}
            name="preference"
            label={t.profile.preference}
            options={[
              { value: "preferred", label: x.preferences.preferred },
              { value: "normal", label: x.preferences.normal },
              { value: "rare", label: x.preferences.rare },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="maxPerWeek"
              label={x.maxPerWeek}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="exactPerWeek"
              label={x.exactPerWeek}
              inputMode="numeric"
            />
          </div>
          <TextareaField
            control={form.control}
            name="note"
            label={t.profile.note}
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
  const { editors: x } = useT();
  return (
    <ConfirmButton
      title={x.removeTitle(label)}
      description={x.removeText}
      confirmLabel={x.remove}
      successMessage={x.removed}
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
  const t = useT();
  const x = t.editors;
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> {x.addRelation}
        </Button>
      }
      title={x.addRelation}
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
            label={t.profile.rule}
            options={[
              { value: "same_days_off", label: x.sameDaysOff },
              { value: "different_weekend_off", label: x.differentWeekend },
            ]}
          />
          <SelectField
            control={form.control}
            name="employeeBId"
            label={t.profile.with}
            options={others}
          />
          <TextareaField
            control={form.control}
            name="note"
            label={t.profile.note}
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}

export function DeleteRelationButton({ id }: { id: string }) {
  const { editors: x } = useT();
  return (
    <ConfirmButton
      title={x.deleteRelation}
      action={() => deleteRelation({ id })}
    />
  );
}

export function UnavailabilityDialog({ employeeId }: { employeeId: string }) {
  const t = useT();
  const x = t.editors;
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> {x.addUnavailability}
        </Button>
      }
      title={x.addUnavailability}
      description={x.unavailabilityText}
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
            label={t.profile.date}
            type="date"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="startTime"
              label={x.fromTime}
              placeholder="08:00"
            />
            <TextField
              control={form.control}
              name="endTime"
              label={x.toTime}
              placeholder="13:00"
            />
          </div>
          <TextField
            control={form.control}
            name="reason"
            label={t.profile.reason}
          />
        </>
      )}
    </FormDialog>
  );
}

export function DeleteUnavailabilityButton({ id }: { id: string }) {
  const { editors: x } = useT();
  return (
    <ConfirmButton
      title={x.deleteUnavailability}
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
  const t = useT();
  const x = t.editors;
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> {x.adjustment}
        </Button>
      }
      title={x.adjustmentTitle}
      description={x.adjustmentText}
      schema={hourBankAdjustmentSchema}
      defaultValues={{ employeeId, entryDate: today, hours: "", note: "" }}
      action={addHourBankAdjustment}
      successMessage={x.adjustmentSaved}
    >
      {(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="entryDate"
              label={t.profile.date}
              type="date"
            />
            <TextField
              control={form.control}
              name="hours"
              label={x.signedHours}
              placeholder="-7.6"
              inputMode="decimal"
            />
          </div>
          <TextareaField
            control={form.control}
            name="note"
            label={t.profile.reason}
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}
