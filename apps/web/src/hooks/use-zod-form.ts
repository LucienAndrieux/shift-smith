"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type DefaultValues, useForm } from "react-hook-form";
import type { z } from "zod";

/**
 * React Hook Form bound to a shared Zod schema. Fields hold the schema *input*
 * (strings from inputs); `submit` validates, then hands the raw input to the
 * callback so Server Actions re-validate the exact same shape.
 */
export function useZodForm<
  S extends z.ZodType<unknown, Record<string, unknown>>,
>(schema: S, defaultValues: z.input<S>) {
  type Input = z.input<S> & Record<string, unknown>;
  const form = useForm<Input, unknown, z.output<S> & Record<string, unknown>>({
    resolver: zodResolver(schema as never),
    defaultValues: defaultValues as DefaultValues<Input>,
  });
  const submit = (fn: (values: Input) => unknown) =>
    form.handleSubmit(async () => {
      await fn(form.getValues());
    });
  return Object.assign(form, { submit });
}
