"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { naturalLanguageConstraints } from "@/db/schema";
import { parsedConstraintSchema } from "@/lib/constraints/operations";
import { constraintFormSchema } from "@/lib/schemas/constraints";
import { idSchema } from "@/lib/schemas/reference";
import { ActionError, managerAction, userAction } from "@/server/action";
import { audit } from "@/server/audit";
import { applyOperations } from "@/server/constraints/apply";
import { assertLlmAllowed } from "@/server/demo/limits";
import { enqueueConstraintParse } from "@/server/jobs/boss";
import type { CurrentUser } from "@/server/session";

/**
 * Managers handle every constraint; an employee only the requests they wrote
 * (retry); read-only visitors none.
 */
async function loadConstraintFor(id: string, user: CurrentUser) {
  const [row] = await db
    .select()
    .from(naturalLanguageConstraints)
    .where(eq(naturalLanguageConstraints.id, id));
  if (!row || (user.role !== "manager" && row.createdBy !== user.id))
    throw new ActionError("Constraint not found.");
  return row;
}

/** Managers write constraints, employees send requests for the managers. */
export const submitConstraint = userAction(
  constraintFormSchema,
  async ({ rawText, target }, user) => {
    if (user.role === "viewer")
      throw new ActionError("Read-only visitors cannot send constraints.");
    await assertLlmAllowed(user);
    const [targetYear, targetMonth] = target.split("-").map(Number);
    const [row] = await db
      .insert(naturalLanguageConstraints)
      .values({
        // An employee writes in the first person: the name tells the model who.
        rawText:
          user.role === "employee" ? `${user.name}: ${rawText}` : rawText,
        targetYear,
        targetMonth,
        status: "pending",
        createdBy: user.id,
      })
      .returning();
    await audit(db, {
      userId: user.id,
      action: "create",
      entity: "natural_language_constraint",
      entityId: row.id,
      diff: { rawText, targetYear, targetMonth },
    });
    try {
      await enqueueConstraintParse(row.id);
    } catch (error) {
      console.error("[constraints] enqueue failed", error);
      await db
        .update(naturalLanguageConstraints)
        .set({
          status: "failed",
          parseError: "Could not queue the parsing job.",
        })
        .where(eq(naturalLanguageConstraints.id, row.id));
    }
    return { id: row.id };
  },
);

export const retryConstraint = userAction(idSchema, async ({ id }, user) => {
  await loadConstraintFor(id, user);
  await assertLlmAllowed(user);
  const [row] = await db
    .update(naturalLanguageConstraints)
    .set({ status: "pending", parseError: null })
    .where(eq(naturalLanguageConstraints.id, id))
    .returning();
  if (!row) throw new ActionError("Constraint not found.");
  await audit(db, {
    userId: user.id,
    action: "retry",
    entity: "natural_language_constraint",
    entityId: id,
  });
  await enqueueConstraintParse(id);
});

export const approveConstraint = managerAction(
  idSchema,
  async ({ id }, user) => {
    await loadConstraintFor(id, user);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(naturalLanguageConstraints)
        .where(eq(naturalLanguageConstraints.id, id))
        .for("update");
      if (!row) throw new ActionError("Constraint not found.");
      if (row.status !== "parsed") {
        throw new ActionError(
          "Only successfully parsed constraints can be approved.",
        );
      }
      const parsed = parsedConstraintSchema.parse(row.parsed);
      const applied = await applyOperations(tx, parsed.operations, {
        constraintId: id,
        userId: user.id,
        rawText: row.rawText,
      });
      await tx
        .update(naturalLanguageConstraints)
        .set({
          status: "approved",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(naturalLanguageConstraints.id, id));
      await audit(tx, {
        userId: user.id,
        action: "approve",
        entity: "natural_language_constraint",
        entityId: id,
        diff: { appliedOperations: applied },
      });
    });
  },
);

export const rejectConstraint = managerAction(
  idSchema,
  async ({ id }, user) => {
    const row = await loadConstraintFor(id, user);
    if (row.status === "approved")
      throw new ActionError("This constraint was already applied.");
    await db.transaction(async (tx) => {
      await tx
        .update(naturalLanguageConstraints)
        .set({
          status: "rejected",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(naturalLanguageConstraints.id, id));
      await audit(tx, {
        userId: user.id,
        action: "reject",
        entity: "natural_language_constraint",
        entityId: id,
      });
    });
  },
);
