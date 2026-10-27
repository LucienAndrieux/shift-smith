"use client";

import { Pencil } from "lucide-react";
import { TextareaField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { idSchema, sectionSchema } from "@/lib/schemas/reference";
import { updateSection } from "./actions";

export function SectionDialog({
  section,
}: {
  section: {
    id: string;
    name: string;
    coverageNote: string | null;
    sortOrder: number;
  };
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil /> Edit section
        </Button>
      }
      title={`Edit ${section.name}`}
      schema={sectionSchema.extend(idSchema.shape)}
      defaultValues={{
        id: section.id,
        name: section.name,
        coverageNote: section.coverageNote ?? "",
        sortOrder: String(section.sortOrder),
      }}
      action={updateSection}
    >
      {(form) => (
        <>
          <TextField control={form.control} name="name" label="Name" />
          <TextField
            control={form.control}
            name="sortOrder"
            label="Sort order"
            inputMode="numeric"
          />
          <TextareaField
            control={form.control}
            name="coverageNote"
            label="Coverage note"
          />
        </>
      )}
    </FormDialog>
  );
}
