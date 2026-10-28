"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { naturalLanguageConstraints } from "@/db/schema";
import { parsedConstraintSchema } from "@/lib/constraints/operations";
import { constraintFormSchema } from "@/lib/schemas/constraints";
import { idSchema } from "@/lib/schemas/reference";
import { ActionError, plannerAction } from "@/server/action";
import { audit } from "@/server/audit";
import { applyOperations } from "@/server/constraints/apply";
import { applyOperationsToOwnDraft } from "@/server/demo/constraints";
import { assertLlmAllowed } from "@/server/demo/limits";
import { enqueueConstraintParse } from "@/server/jobs/boss";
import type { CurrentUser } from "@/server/session";

/** Demo managers only handle the constraints they wrote. */
async function loadOwnConstraint(id: string, user: CurrentUser) {
  const [row] = await db
    .select()
    .from(naturalLanguageConstraints)
    .where(eq(naturalLanguageConstraints.id, id));
  if (!row || (user.role !== "admin" && row.createdBy !== user.id))
    throw new ActionError("Constraint not found.");
  return row;
}

export const submitConstraint = plannerAction(
  constraintFormSchema,
  async ({ rawText, target }, user) => {
    await assertLlmAllowed(user);
    const [targetYear, targetMonth] = target.split("-").map(Number);
    const [row] = await db
      .insert(naturalLanguageConstraints)
      .values({
        rawText,
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

export const retryConstraint = plannerAction(idSchema, async ({ id }, user) => {
  await loadOwnConstraint(id, user);
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

export const approveConstraint = plannerAction(
  idSchema,
  async ({ id }, user) => {
    await loadOwnConstraint(id, user);
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
      const applied =
        user.role === "admin"
          ? await applyOperations(tx, parsed.operations, {
              constraintId: id,
              userId: user.id,
              rawText: row.rawText,
            })
          : await applyOperationsToOwnDraft(tx, parsed.operations, {
              user,
              constraintId: id,
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

export const rejectConstraint = plannerAction(
  idSchema,
  async ({ id }, user) => {
    const row = await loadOwnConstraint(id, user);
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
