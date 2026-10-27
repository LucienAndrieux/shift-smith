"use client";

import type { ComponentProps } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Labelled input bound to React Hook Form, with inline errors. */
export function TextField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  description,
  ...inputProps
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<ComponentProps<typeof Input>, "name">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            id={field.name}
            aria-invalid={fieldState.invalid}
            {...inputProps}
            {...field}
            value={field.value ?? ""}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
