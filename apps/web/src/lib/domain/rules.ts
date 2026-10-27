import { z } from "zod";
import { BIRTHDAY_LEAVE, REST_DAY } from "./day-codes";
import type { SchedulingRule } from "./types";

/**
 * Rule codes understood by the validator and the solver. Rules are data:
 * they can be disabled (`isActive`), downgraded to warnings (`isHard = false`) and
 * overridden per section or employee (employee > section > global).
 */
export const RULE_CODES = [
  "weekly_contract_hours_default",
  "max_consecutive_work_days",
  "min_rest_between_shifts_hours",
  "weekend_off_per_month",
  "birthday_off",
  "two_rest_days_per_week",
  "approved_leave_is_fixed",
] as const;

export type RuleCode = (typeof RULE_CODES)[number];

/** Every rule value is stored as `{ "value": … }` plus optional descriptive fields. */
export const ruleValueSchemas = {
  weekly_contract_hours_default: z.object({ value: z.number().positive() }),
  max_consecutive_work_days: z.object({ value: z.number().int().positive() }),
  min_rest_between_shifts_hours: z.object({ value: z.number().nonnegative() }),
  weekend_off_per_month: z.object({ value: z.number().int().nonnegative() }),
  birthday_off: z.object({
    value: z.boolean(),
    code_used: z.string().optional(),
  }),
  two_rest_days_per_week: z.object({ value: z.boolean() }),
  approved_leave_is_fixed: z.object({ value: z.boolean() }),
} satisfies Record<RuleCode, z.ZodType>;

export type RuleValue<C extends RuleCode> = z.infer<
  (typeof ruleValueSchemas)[C]
>;

export const RULE_DEFAULTS: { [C in RuleCode]: RuleValue<C> } = {
  weekly_contract_hours_default: { value: 37.5 },
  max_consecutive_work_days: { value: 6 },
  min_rest_between_shifts_hours: { value: 11 },
  weekend_off_per_month: { value: 1 },
  birthday_off: { value: true, code_used: BIRTHDAY_LEAVE },
  two_rest_days_per_week: { value: true },
  approved_leave_is_fixed: { value: true },
};

export const RULE_DESCRIPTIONS: Record<RuleCode, string> = {
  weekly_contract_hours_default: "Default weekly contract (hours)",
  max_consecutive_work_days: "Maximum consecutive working days",
  min_rest_between_shifts_hours:
    "Minimum rest between the end of a shift and the start of the next (hours)",
  weekend_off_per_month:
    "Full weekends (Sat + Sun) off per month, for employees who require it",
  birthday_off: `Birthday is a day off (${BIRTHDAY_LEAVE})`,
  two_rest_days_per_week: `Two rest days (${REST_DAY}) per ISO week`,
  approved_leave_is_fixed: "Approved leave, sick leave and holidays are fixed",
};

export function isRuleCode(code: string): code is RuleCode {
  return (RULE_CODES as readonly string[]).includes(code);
}

export interface ResolvedRule<C extends RuleCode> {
  value: RuleValue<C>;
  isHard: boolean;
  isActive: boolean;
}

/**
 * Most specific active-or-inactive rule for an employee: employee scope, then
 * section scope (employee's primary section), then global, then built-in default.
 * Invalid stored values fall back to the default.
 */
export function resolveRule<C extends RuleCode>(
  rules: readonly SchedulingRule[],
  code: C,
  target: { employeeId?: string; sectionId?: string } = {},
): ResolvedRule<C> {
  const candidates = rules.filter((r) => r.code === code);
  const match =
    (target.employeeId &&
      candidates.find(
        (r) => r.scope === "employee" && r.employeeId === target.employeeId,
      )) ||
    (target.sectionId &&
      candidates.find(
        (r) => r.scope === "section" && r.sectionId === target.sectionId,
      )) ||
    candidates.find((r) => r.scope === "global");

  if (!match)
    return { value: RULE_DEFAULTS[code], isHard: true, isActive: true };
  const parsed = ruleValueSchemas[code].safeParse(match.value);
  return {
    value: (parsed.success ? parsed.data : RULE_DEFAULTS[code]) as RuleValue<C>,
    isHard: match.isHard,
    isActive: match.isActive,
  };
}
