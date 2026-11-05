"use client";

import { Pencil, Plus } from "lucide-react";
import { TextareaField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { idSchema, sectionSchema } from "@/lib/schemas/reference";
import { createSection, updateSection } from "./actions";

/** New section, placed after the others by default. */
export function NewSectionDialog({ sortOrder }: { sortOrder: number }) {
  const { sections: se } = useT();
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus /> {se.addSection}
        </Button>
      }
      title={se.newSection}
      description={se.newSectionText}
      schema={sectionSchema}
      defaultValues={{
        name: "",
        coverageNote: "",
        sortOrder: String(sortOrder),
      }}
      action={createSection}
      successMessage={se.sectionCreated}
    >
      {(form) => (
        <>
          <TextField control={form.control} name="name" label={se.name} />
          <TextField
            control={form.control}
            name="sortOrder"
            label={se.sortOrder}
            inputMode="numeric"
          />
          <TextareaField
            control={form.control}
            name="coverageNote"
            label={se.coverageNote}
          />
        </>
      )}
    </FormDialog>
  );
}

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
  const { sections: se } = useT();
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil /> {se.editSection}
        </Button>
      }
      title={se.editTitle(section.name)}
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
          <TextField control={form.control} name="name" label={se.name} />
          <TextField
            control={form.control}
            name="sortOrder"
            label={se.sortOrder}
            inputMode="numeric"
          />
          <TextareaField
            control={form.control}
            name="coverageNote"
            label={se.coverageNote}
          />
        </>
      )}
    </FormDialog>
  );
}
