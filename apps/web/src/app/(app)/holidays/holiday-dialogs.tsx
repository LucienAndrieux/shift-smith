"use client";

import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { SelectField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { holidaySchema } from "@/lib/schemas/reference";
import { createHoliday, deleteHoliday, updateHoliday } from "./actions";

interface HolidayInitial {
  id: string;
  date: string;
  name: string;
  type: "public" | "regional" | "company";
}

export function HolidayDialog({ initial }: { initial?: HolidayInitial }) {
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add holiday
          </Button>
        )
      }
      title={initial ? "Edit holiday" : "New holiday"}
      schema={holidaySchema}
      defaultValues={{
        date: initial?.date ?? "",
        name: initial?.name ?? "",
        type: initial?.type ?? "public",
      }}
      action={(values) =>
        initial
          ? updateHoliday({ ...values, id: initial.id })
          : createHoliday(values)
      }
    >
      {(form) => (
        <>
          <TextField
            control={form.control}
            name="date"
            label="Date"
            type="date"
          />
          <TextField control={form.control} name="name" label="Name" />
          <SelectField
            control={form.control}
            name="type"
            label="Type"
            options={[
              { value: "public", label: "Public" },
              { value: "regional", label: "Regional" },
              { value: "other", label: "Other" },
            ]}
          />
        </>
      )}
    </FormDialog>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this holiday?"
      action={() => deleteHoliday({ id })}
    />
  );
}
