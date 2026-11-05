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

/** An action behind a confirmation dialog (destructive by default). */
export function ConfirmButton<T>({
  title,
  description,
  confirmLabel,
  successMessage,
  action,
  onSuccess,
  trigger,
  children,
  destructive = true,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  successMessage?: string;
  action: () => Promise<ActionResult<T>>;
  /** Replaces the success toast: the caller reports the outcome from the data. */
  onSuccess?: (data: T) => void;
  trigger?: ReactNode;
  /** Extra content between the text and the buttons (choices for the action). */
  children?: ReactNode;
  /** false: a plain confirmation (approve), not a red delete button. */
  destructive?: boolean;
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
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              const result = await run(action, {
                success: onSuccess
                  ? undefined
                  : (successMessage ?? t.common.deleted),
              });
              if (result.ok) onSuccess?.(result.data);
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
