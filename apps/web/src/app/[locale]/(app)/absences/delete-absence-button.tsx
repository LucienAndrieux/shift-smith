"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { useT } from "@/components/i18n-provider";
import { deleteAbsence } from "./actions";

export function DeleteAbsenceButton({ id }: { id: string }) {
  const t = useT();
  return (
    <ConfirmButton
      title={t.absences.deleteTitle}
      description={t.absences.deleteText}
      action={() => deleteAbsence({ id })}
    />
  );
}
