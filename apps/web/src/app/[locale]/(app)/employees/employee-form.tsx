"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckboxField,
  type Option,
  SelectField,
  TextareaField,
} from "@/components/form/fields";
import { TextField } from "@/components/form/text-field";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { MONTH_NAMES } from "@/lib/domain/calendar";
import {
  type EmployeeFormValues,
  employeeSchema,
} from "@/lib/schemas/reference";
import { createEmployee, updateEmployee } from "./actions";

export interface EmployeeFormInitial {
  id: string;
  displayName: string;
  fullName: string | null;
  employeeNumber: string | null;
  primarySectionId: string;
  status: "active" | "inactive";
  weeklyContractMinutes: number;
  reducedSchedule: boolean;
  monthlyTlDays: number;
  requiresMonthlyWeekendOff: boolean;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  hiredOn: string | null;
  leftOn: string | null;
  notes: string | null;
  toConfirm: boolean;
}

function toFormValues(
  e: EmployeeFormInitial | undefined,
  sections: Option[],
): EmployeeFormValues {
  return {
    displayName: e?.displayName ?? "",
    fullName: e?.fullName ?? "",
    employeeNumber: e?.employeeNumber ?? "",
    primarySectionId: e?.primarySectionId ?? sections[0]?.value ?? "",
    status: e?.status ?? "active",
    weeklyContractHours: String((e?.weeklyContractMinutes ?? 38 * 60) / 60),
    reducedSchedule: e?.reducedSchedule ?? false,
    monthlyTlDays: String(e?.monthlyTlDays ?? 0),
    requiresMonthlyWeekendOff: e?.requiresMonthlyWeekendOff ?? false,
    birthdayMonth: e?.birthdayMonth ? String(e.birthdayMonth) : "",
    birthdayDay: e?.birthdayDay ? String(e.birthdayDay) : "",
    hiredOn: e?.hiredOn ?? "",
    leftOn: e?.leftOn ?? "",
    notes: e?.notes ?? "",
    toConfirm: e?.toConfirm ?? false,
  };
}

export function EmployeeFormDialog({
  employee,
  sections,
}: {
  employee?: EmployeeFormInitial;
  sections: Option[];
}) {
  const t = useT();
  const e = t.employees;
  const locale = useLocale();
  const monthOptions: Option[] = MONTH_NAMES[locale].map((name, i) => ({
    value: String(i + 1),
    label: name,
  }));
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const form = useZodForm(employeeSchema, toFormValues(employee, sections));

  async function onSubmit(values: EmployeeFormValues) {
    if (employee) {
      const result = await run(
        () => updateEmployee({ ...values, id: employee.id }),
        {
          success: e.updated,
        },
      );
      if (result.ok) setOpen(false);
      return;
    }
    const result = await run(() => createEmployee(values), {
      success: e.created,
    });
    if (result.ok) {
      setOpen(false);
      router.push(`/employees/${result.data.id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(toFormValues(employee, sections));
      }}
    >
      <DialogTrigger asChild>
        {employee ? (
          <Button variant="outline" size="sm">
            <Pencil /> {e.editProfile}
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> {e.new}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? e.edit : e.new}</DialogTitle>
          <DialogDescription>{e.formText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="displayName"
                label={e.name}
              />
              <TextField
                control={form.control}
                name="fullName"
                label={e.fullName}
              />
              <TextField
                control={form.control}
                name="employeeNumber"
                label={e.employeeNumber}
              />
              <SelectField
                control={form.control}
                name="primarySectionId"
                label={e.section}
                options={sections}
              />
              <TextField
                control={form.control}
                name="weeklyContractHours"
                label={e.weeklyContract}
                inputMode="decimal"
              />
              <TextField
                control={form.control}
                name="monthlyTlDays"
                label={e.tlPerMonthLong}
                inputMode="numeric"
              />
              <SelectField
                control={form.control}
                name="birthdayMonth"
                label={e.birthdayMonth}
                options={monthOptions}
                noneLabel="—"
              />
              <TextField
                control={form.control}
                name="birthdayDay"
                label={e.birthdayDay}
                inputMode="numeric"
              />
              <TextField
                control={form.control}
                name="hiredOn"
                label={e.hiredOn}
                type="date"
              />
              <TextField
                control={form.control}
                name="leftOn"
                label={e.leftOn}
                type="date"
              />
              <SelectField
                control={form.control}
                name="status"
                label={e.status}
                options={[
                  { value: "active", label: e.active },
                  { value: "inactive", label: e.inactive },
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxField
                control={form.control}
                name="reducedSchedule"
                label={e.reducedSchedule}
                description={e.reducedText}
              />
              <CheckboxField
                control={form.control}
                name="requiresMonthlyWeekendOff"
                label={e.needsWeekend}
              />
              <CheckboxField
                control={form.control}
                name="toConfirm"
                label={e.dataToConfirm}
              />
            </div>
            <TextareaField
              control={form.control}
              name="notes"
              label={e.notes}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
