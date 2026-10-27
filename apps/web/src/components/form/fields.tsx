"use client";

import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Radix Select cannot hold "" as an item value; this sentinel stands for "none". */
const NONE = "__none__";

export interface Option {
  value: string;
  label: string;
}

export function SelectField<
  T extends FieldValues,
  TOut extends FieldValues = T,
>({
  control,
  name,
  label,
  options,
  placeholder = "Choose…",
  noneLabel,
  description,
  disabled,
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  options: Option[];
  placeholder?: string;
  /** When set, adds an empty choice with this label (value ""). */
  noneLabel?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Select
            value={
              field.value === "" && noneLabel ? NONE : field.value || undefined
            }
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger
              id={field.name}
              aria-invalid={fieldState.invalid}
              className="w-full"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function CheckboxField<
  T extends FieldValues,
  TOut extends FieldValues = T,
>({
  control,
  name,
  label,
  description,
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  description?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Checkbox
            id={field.name}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor={field.name} className="font-normal">
              {label}
            </FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
        </Field>
      )}
    />
  );
}

export function TextareaField<
  T extends FieldValues,
  TOut extends FieldValues = T,
>({
  control,
  name,
  label,
  description,
  rows = 3,
  placeholder,
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea
            id={field.name}
            rows={rows}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
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
