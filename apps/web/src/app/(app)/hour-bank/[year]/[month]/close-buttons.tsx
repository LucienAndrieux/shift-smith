"use client";

import { Lock, LockOpen } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { closeMonth, reopenMonth } from "../../actions";

export function CloseMonthButton({
  scheduleId,
  label,
  count,
}: {
  scheduleId: string;
  label: string;
  count: number;
}) {
  return (
    <ConfirmButton
      title={`Close ${label}?`}
      description={`One monthly closing entry will be written for each of the ${count} employee(s) with a complete month. The schedule becomes read-only.`}
      confirmLabel="Close month"
      successMessage="Month closed"
      action={() => closeMonth({ scheduleId })}
      trigger={
        <Button>
          <Lock /> Close month
        </Button>
      }
    />
  );
}

export function ReopenMonthButton({
  scheduleId,
  label,
}: {
  scheduleId: string;
  label: string;
}) {
  return (
    <ConfirmButton
      title={`Reopen ${label}?`}
      description="The closing entries of this month are deleted from the ledger. You can close it again afterwards."
      confirmLabel="Reopen"
      successMessage="Month reopened"
      action={() => reopenMonth({ scheduleId })}
      trigger={
        <Button variant="outline">
          <LockOpen /> Reopen month
        </Button>
      }
    />
  );
}
