"use client";

import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { SelectField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { useT } from "@/components/i18n-provider";
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
  const { holidays: h } = useT();
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label={h.edit}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> {h.add}
          </Button>
        )
      }
      title={initial ? h.editTitle : h.newTitle}
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
            label={h.date}
            type="date"
          />
          <TextField control={form.control} name="name" label={h.name} />
          <SelectField
            control={form.control}
            name="type"
            label={h.type}
            options={[
              { value: "public", label: h.types.public },
              { value: "regional", label: h.types.regional },
              { value: "other", label: h.types.other },
            ]}
          />
        </>
      )}
    </FormDialog>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  const { holidays: h } = useT();
  return (
    <ConfirmButton title={h.deleteTitle} action={() => deleteHoliday({ id })} />
  );
}
