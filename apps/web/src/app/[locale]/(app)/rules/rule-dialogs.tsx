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
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { RULE_CODES, RULE_DEFAULTS, type RuleCode } from "@/lib/domain/rules";
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

export function RuleDialog({
  initial,
  sections,
  employees,
}: {
  initial?: RuleInitial;
  sections: Option[];
  employees: Option[];
}) {
  const { rules: ru } = useT();
  const codeOptions: Option[] = RULE_CODES.map((c) => ({
    value: c,
    label: ru.descriptions[c],
  }));
  const code = (initial?.code ?? "max_consecutive_work_days") as RuleCode;
  return (
    <FormDialog
      trigger={
        initial ? (
          <Button variant="ghost" size="icon-sm" aria-label={ru.edit}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> {ru.addOverride}
          </Button>
        )
      }
      title={initial ? ru.editTitle : ru.newTitle}
      description={ru.dialogText}
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
            label={ru.rule}
            options={codeOptions}
            disabled={Boolean(initial)}
          />
          <ScopeFields form={form} sections={sections} employees={employees} />
          <TextareaField
            control={form.control}
            name="valueJson"
            label={ru.valueJson}
            rows={2}
            description={ru.valueHelp}
          />
          <div className="flex flex-wrap gap-6">
            <CheckboxField
              control={form.control}
              name="isHard"
              label={ru.hardRule}
            />
            <CheckboxField
              control={form.control}
              name="isActive"
              label={ru.active}
            />
          </div>
          <TextareaField
            control={form.control}
            name="description"
            label={ru.description}
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
  const { rules: ru } = useT();
  const scope = useWatch({ control: form.control, name: "scope" });
  return (
    <>
      <SelectField
        control={form.control}
        name="scope"
        label={ru.appliesTo}
        options={[
          { value: "global", label: ru.scopes.global },
          { value: "section", label: ru.scopes.section },
          { value: "employee", label: ru.scopes.employee },
        ]}
      />
      {scope === "section" && (
        <SelectField
          control={form.control}
          name="sectionId"
          label={ru.section}
          options={sections}
        />
      )}
      {scope === "employee" && (
        <SelectField
          control={form.control}
          name="employeeId"
          label={ru.employee}
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
  const { rules: ru } = useT();
  return (
    <ConfirmButton
      title={ru.deleteTitle}
      description={global ? ru.deleteGlobalText : undefined}
      action={() => deleteRule({ id })}
    />
  );
}
