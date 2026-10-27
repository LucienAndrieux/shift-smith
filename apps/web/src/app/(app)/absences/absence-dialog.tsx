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
  return (
    <FormDialog
      trigger={trigger}
      title={absence ? "Edit absence" : "New absence"}
      description="Approved absences are fixed in every schedule of the period."
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
      successMessage={absence ? "Absence updated" : "Absence created"}
    >
      {(form) => (
        <>
          <SelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            options={employees}
            disabled={Boolean(defaultEmployeeId)}
          />
          <SelectField
            control={form.control}
            name="dayCode"
            label="Code"
            options={codes}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="startDate"
              label="From"
              type="date"
            />
            <TextField
              control={form.control}
              name="endDate"
              label="To (inclusive)"
              type="date"
            />
          </div>
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={[
              { value: "approved", label: "Approved" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <CheckboxField
            control={form.control}
            name="endToConfirm"
            label="End date to confirm"
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
