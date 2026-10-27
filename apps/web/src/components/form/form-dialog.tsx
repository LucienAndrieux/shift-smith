"use client";

import { type ReactNode, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { ActionResult } from "@/server/action";

type FormInput<S extends z.ZodType> = z.input<S> & Record<string, unknown>;

/**
 * A dialog holding a form validated by a shared Zod schema. On submit it calls the
 * Server Action with the raw input, toasts the outcome and closes on success.
 */
export function FormDialog<
  S extends z.ZodType<unknown, Record<string, unknown>>,
>({
  trigger,
  title,
  description,
  schema,
  defaultValues,
  action,
  successMessage = "Saved",
  submitLabel = "Save",
  wide,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  schema: S;
  defaultValues: z.input<S>;
  action: (values: FormInput<S>) => Promise<ActionResult<unknown>>;
  successMessage?: string;
  submitLabel?: string;
  wide?: boolean;
  children: (
    form: UseFormReturn<
      FormInput<S>,
      unknown,
      z.output<S> & Record<string, unknown>
    >,
  ) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const form = useZodForm(schema, defaultValues);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaultValues as FormInput<S>);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={
          wide
            ? "max-h-[90vh] overflow-y-auto sm:max-w-2xl"
            : "max-h-[90vh] overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.submit(async (values) => {
            const result = await run(() => action(values), {
              success: successMessage,
            });
            if (result.ok) setOpen(false);
            else if (result.fieldErrors) {
              for (const [name, messages] of Object.entries(
                result.fieldErrors,
              )) {
                form.setError(name as never, { message: messages[0] });
              }
            }
          })}
        >
          <FieldGroup>{children(form)}</FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
