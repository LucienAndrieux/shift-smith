"use server";

import { eq } from "drizzle-orm";
import { type Database, db } from "@/db";
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

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ConstraintRow = typeof naturalLanguageConstraints.$inferSelect;

/** Seeded example shown to every visitor (no author). */
const isExample = (row: ConstraintRow) =>
  row.createdBy === null && row.model === "example";

/**
 * Demo managers only handle the constraints they wrote, plus the seeded examples
 * when `allowExample` (they review a private copy, see `reviewedCopyId`).
 */
async function loadOwnConstraint(
  id: string,
  user: CurrentUser,
  { allowExample = false } = {},
) {
  const [row] = await db
    .select()
    .from(naturalLanguageConstraints)
    .where(eq(naturalLanguageConstraints.id, id));
  if (
    !row ||
    (user.role !== "admin" &&
      row.createdBy !== user.id &&
      !(allowExample && isExample(row)))
  )
    throw new ActionError("Constraint not found.");
  return row;
}

/**
 * The constraint a review applies to: the row itself, or for a demo manager
 * reviewing a shared example, a private copy of it (the example stays untouched
 * for the other visitors and the copy goes away with the guest).
 */
async function reviewedCopyId(tx: Tx, row: ConstraintRow, user: CurrentUser) {
  if (user.role === "admin" || !isExample(row)) return row.id;
  if (row.status !== "parsed") {
    throw new ActionError("Only constraints ready for review can be reviewed.");
  }
  const [copy] = await tx
    .insert(naturalLanguageConstraints)
    .values({
      rawText: row.rawText,
      targetYear: row.targetYear,
      targetMonth: row.targetMonth,
      status: row.status,
      parsed: row.parsed,
      model: row.model,
      createdBy: user.id,
    })
    .returning({ id: naturalLanguageConstraints.id });
  return copy.id;
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
  async ({ id: requestedId }, user) => {
    const source = await loadOwnConstraint(requestedId, user, {
      allowExample: true,
    });
    await db.transaction(async (tx) => {
      const id = await reviewedCopyId(tx, source, user);
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
  async ({ id: requestedId }, user) => {
    const row = await loadOwnConstraint(requestedId, user, {
      allowExample: true,
    });
    if (row.status === "approved")
      throw new ActionError("This constraint was already applied.");
    await db.transaction(async (tx) => {
      const id = await reviewedCopyId(tx, row, user);
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
