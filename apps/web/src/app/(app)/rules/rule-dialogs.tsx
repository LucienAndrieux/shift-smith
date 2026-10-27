"use client";

import { Pencil, Plus } from "lucide-react";
import { useWatch } from "react-hook-form";
import { ConfirmButton } from "@/components/confirm-button";
import {
  CheckboxField,
  type Option,
  SelectField,
  TextareaField,
} from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { Button } from "@/components/ui/button";
import {
  RULE_CODES,
  RULE_DEFAULTS,
  RULE_DESCRIPTIONS,
  type RuleCode,
} from "@/lib/domain/rules";
import { ruleSchema } from "@/lib/schemas/reference";
import { createRule, deleteRule, updateRule } from "./actions";

export interface RuleInitial {
  id: string;
  code: string;
  scope: "global" | "section" | "employee";
  sectionId: string | null;
  employeeId: string | null;
  value: unknown;
  isHard: boolean;
  isActive: boolean;
  description: string | null;
}

const CODE_OPTIONS: Option[] = RULE_CODES.map((code) => ({
  value: code,
  label: RULE_DESCRIPTIONS[code],
}));

export function RuleDialog({
  initial,
  sections,
  employees,
}: {
  initial?: RuleInitial;
  sections: Option[];
  employees: Option[];
}) {
  const code = (initial?.code ?? "max_consecutive_work_days") as RuleCode;
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add rule override
          </Button>
        )
      }
      title={initial ? "Edit rule" : "New rule"}
      description="Employee rules override section rules, which override global ones. A soft rule is reported as a warning."
      schema={ruleSchema}
      defaultValues={{
        code,
        scope: initial?.scope ?? "employee",
        sectionId: initial?.sectionId ?? "",
        employeeId: initial?.employeeId ?? "",
        valueJson: JSON.stringify(initial?.value ?? RULE_DEFAULTS[code]),
        isHard: initial?.isHard ?? true,
        isActive: initial?.isActive ?? true,
        description: initial?.description ?? "",
      }}
      action={(values) =>
        initial ? updateRule({ ...values, id: initial.id }) : createRule(values)
      }
    >
      {(form) => (
        <>
          <SelectField
            control={form.control}
            name="code"
            label="Rule"
            options={CODE_OPTIONS}
            disabled={Boolean(initial)}
          />
          <ScopeFields form={form} sections={sections} employees={employees} />
          <TextareaField
            control={form.control}
            name="valueJson"
            label="Value (JSON)"
            rows={2}
            description='For example {"value": 6}. The format is checked against the rule.'
          />
          <div className="flex flex-wrap gap-6">
            <CheckboxField
              control={form.control}
              name="isHard"
              label="Hard rule"
            />
            <CheckboxField
              control={form.control}
              name="isActive"
              label="Active"
            />
          </div>
          <TextareaField
            control={form.control}
            name="description"
            label="Description"
            rows={2}
          />
        </>
      )}
    </FormDialog>
  );
}

function ScopeFields({
  form,
  sections,
  employees,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: form shape comes from ruleSchema
  form: any;
  sections: Option[];
  employees: Option[];
}) {
  const scope = useWatch({ control: form.control, name: "scope" });
  return (
    <>
      <SelectField
        control={form.control}
        name="scope"
        label="Applies to"
        options={[
          { value: "global", label: "Everyone (global)" },
          { value: "section", label: "One section" },
          { value: "employee", label: "One employee" },
        ]}
      />
      {scope === "section" && (
        <SelectField
          control={form.control}
          name="sectionId"
          label="Section"
          options={sections}
        />
      )}
      {scope === "employee" && (
        <SelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          options={employees}
        />
      )}
    </>
  );
}

export function DeleteRuleButton({
  id,
  global,
}: {
  id: string;
  global: boolean;
}) {
  return (
    <ConfirmButton
      title="Delete this rule?"
      description={
        global
          ? "Without a global rule the validator falls back to the built-in default. Prefer deactivating it."
          : undefined
      }
      action={() => deleteRule({ id })}
    />
  );
}
