"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { absences, dayCodes } from "@/db/schema";
import { absenceSchema, idSchema } from "@/lib/schemas/reference";
import { ActionError, managerAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

async function assertAbsenceCode(code: string) {
  const [row] = await db.select().from(dayCodes).where(eq(dayCodes.code, code));
  if (row?.kind !== "absence") {
    throw new ActionError(`${code} is not an absence code.`);
  }
}

export const createAbsence = managerAction(
  absenceSchema,
  async (input, user) => {
    await assertAbsenceCode(input.dayCode);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(absences)
        .values({ ...input, source: "manual", createdBy: user.id })
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "absence",
        entityId: row.id,
        diff: row,
      });
      return { id: row.id };
    });
  },
);

export const updateAbsence = managerAction(
  absenceSchema.and(idSchema),
  async ({ id, ...input }, user) => {
    await assertAbsenceCode(input.dayCode);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(absences)
        .where(eq(absences.id, id));
      if (!before) throw new ActionError("Absence not found.");
      await tx.update(absences).set(input).where(eq(absences.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "absence",
        entityId: id,
        diff: changes(before, input),
      });
    });
  },
);

export const deleteAbsence = managerAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(absences)
      .where(eq(absences.id, id))
      .returning();
    if (!row) throw new ActionError("Absence not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "absence",
      entityId: id,
      diff: row,
    });
  });
});
