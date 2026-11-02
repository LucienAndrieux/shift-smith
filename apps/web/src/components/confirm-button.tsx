"use client";

import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import type { ActionResult } from "@/server/action";

/** Destructive action behind a confirmation dialog. */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  successMessage,
  action,
  trigger,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  successMessage?: string;
  action: () => Promise<ActionResult<unknown>>;
  trigger?: ReactNode;
}) {
  const t = useT();
  const { pending, run } = useAction();
  const label = confirmLabel ?? t.common.delete;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <Trash2 />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(action, { success: successMessage ?? t.common.deleted })
            }
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
