"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { deleteAbsence } from "./actions";

export function DeleteAbsenceButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      title="Delete this absence?"
      description="To keep a trace, edit it and set its status to Cancelled instead."
      action={() => deleteAbsence({ id })}
    />
  );
}
