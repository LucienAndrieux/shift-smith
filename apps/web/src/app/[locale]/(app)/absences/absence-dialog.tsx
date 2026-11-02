"use client";

import type { ReactNode } from "react";
import {
  CheckboxField,
  type Option,
  SelectField,
  TextareaField,
} from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { useT } from "@/components/i18n-provider";
import { absenceSchema } from "@/lib/schemas/reference";
import { createAbsence, updateAbsence } from "./actions";

export interface AbsenceInitial {
  id: string;
  employeeId: string;
  dayCode: string;
  startDate: string;
  endDate: string;
  status: "approved" | "cancelled";
  endToConfirm: boolean;
  note: string | null;
}

/** Create or edit an absence (leave, sick leave, birthday, time off in lieu…). */
export function AbsenceDialog({
  trigger,
  absence,
  employees,
  codes,
  defaultEmployeeId,
}: {
  trigger: ReactNode;
  absence?: AbsenceInitial;
  employees: Option[];
  /** Absence day codes only. */
  codes: Option[];
  defaultEmployeeId?: string;
}) {
  const t = useT();
  return (
    <FormDialog
      trigger={trigger}
      title={absence ? t.absences.edit : t.absences.new}
      description={t.absences.dialogText}
      schema={absenceSchema}
      defaultValues={{
        employeeId: absence?.employeeId ?? defaultEmployeeId ?? "",
        dayCode: absence?.dayCode ?? "AL",
        startDate: absence?.startDate ?? "",
        endDate: absence?.endDate ?? "",
        status: absence?.status ?? "approved",
        endToConfirm: absence?.endToConfirm ?? false,
        note: absence?.note ?? "",
      }}
      action={(values) =>
        absence
          ? updateAbsence({ ...values, id: absence.id })
          : createAbsence(values)
      }
      successMessage={absence ? t.absences.updated : t.absences.created}
    >
      {(form) => (
        <>
          <SelectField
            control={form.control}
            name="employeeId"
            label={t.absences.employee}
            options={employees}
            disabled={Boolean(defaultEmployeeId)}
          />
          <SelectField
            control={form.control}
            name="dayCode"
            label={t.absences.code}
            options={codes}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="startDate"
              label={t.absences.from}
              type="date"
            />
            <TextField
              control={form.control}
              name="endDate"
              label={t.absences.toInclusive}
              type="date"
            />
          </div>
          <SelectField
            control={form.control}
            name="status"
            label={t.absences.status}
            options={[
              { value: "approved", label: t.absences.statuses.approved },
              { value: "cancelled", label: t.absences.statuses.cancelled },
            ]}
          />
          <CheckboxField
            control={form.control}
            name="endToConfirm"
            label={t.absences.endToConfirm}
          />
          <TextareaField
            control={form.control}
            name="note"
            label={t.absences.note}
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}
