"use server";

import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { schedulingRules } from "@/db/schema";
import { ruleValueSchemas } from "@/lib/domain/rules";
import { idSchema, ruleSchema } from "@/lib/schemas/reference";
import { ActionError, managerAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

/** Parses and validates the JSON value against the rule's own schema. */
function toRow(input: z.output<typeof ruleSchema>) {
  let value: unknown;
  try {
    value = JSON.parse(input.valueJson);
  } catch {
    throw new ActionError("The value is not valid JSON.");
  }
  const parsed = ruleValueSchemas[input.code].safeParse(value);
  if (!parsed.success) {
    throw new ActionError(
      `Invalid value for ${input.code}: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  return {
    code: input.code,
    scope: input.scope,
    sectionId: input.scope === "section" ? input.sectionId : null,
    employeeId: input.scope === "employee" ? input.employeeId : null,
    value: parsed.data,
    isHard: input.isHard,
    isActive: input.isActive,
    description: input.description,
  };
}

export const createRule = managerAction(ruleSchema, async (input, user) => {
  const values = toRow(input);
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(schedulingRules).values(values).returning();
    await audit(tx, {
      userId: user.id,
      action: "create",
      entity: "scheduling_rule",
      entityId: row.id,
      diff: row,
    });
  });
});

export const updateRule = managerAction(
  ruleSchema.and(idSchema),
  async ({ id, ...input }, user) => {
    const values = toRow(input);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schedulingRules)
        .where(eq(schedulingRules.id, id));
      if (!before) throw new ActionError("Rule not found.");
      await tx
        .update(schedulingRules)
        .set(values)
        .where(eq(schedulingRules.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "scheduling_rule",
        entityId: id,
        diff: changes(before, values),
      });
    });
  },
);

export const deleteRule = managerAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(schedulingRules)
      .where(eq(schedulingRules.id, id))
      .returning();
    if (!row) throw new ActionError("Rule not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "scheduling_rule",
      entityId: id,
      diff: row,
    });
  });
});
