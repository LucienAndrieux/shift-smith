"use client";

import { Lock, LockOpen } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { useT } from "@/components/i18n-provider";
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
  const { hourBank: hb } = useT();
  return (
    <ConfirmButton
      title={hb.closeTitle(label)}
      description={hb.closeText(count)}
      confirmLabel={hb.closeMonth}
      successMessage={hb.closed}
      action={() => closeMonth({ scheduleId })}
      trigger={
        <Button>
          <Lock /> {hb.closeMonth}
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
  const { hourBank: hb } = useT();
  return (
    <ConfirmButton
      title={hb.reopenTitle(label)}
      description={hb.reopenText}
      confirmLabel={hb.reopen}
      successMessage={hb.reopened}
      action={() => reopenMonth({ scheduleId })}
      trigger={
        <Button variant="outline">
          <LockOpen /> {hb.reopenMonth}
        </Button>
      }
    />
  );
}
