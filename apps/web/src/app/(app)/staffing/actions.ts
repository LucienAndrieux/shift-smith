"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staffingOverrides, staffingRequirements } from "@/db/schema";
import {
  idSchema,
  staffingOverrideSchema,
  staffingRequirementSchema,
} from "@/lib/schemas/reference";
import { ActionError, managerAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

export const createRequirement = managerAction(
  staffingRequirementSchema,
  async (input, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(staffingRequirements)
        .values(input)
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "staffing_requirement",
        entityId: row.id,
        diff: row,
      });
    });
  },
);

export const updateRequirement = managerAction(
  staffingRequirementSchema.and(idSchema),
  async ({ id, ...input }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(staffingRequirements)
        .where(eq(staffingRequirements.id, id));
      if (!before) throw new ActionError("Requirement not found.");
      await tx
        .update(staffingRequirements)
        .set(input)
        .where(eq(staffingRequirements.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "staffing_requirement",
        entityId: id,
        diff: changes(before, input),
      });
    });
  },
);

export const deleteRequirement = managerAction(
  idSchema,
  async ({ id }, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(staffingRequirements)
        .where(eq(staffingRequirements.id, id))
        .returning();
      if (!row) throw new ActionError("Requirement not found.");
      await audit(tx, {
        userId: user.id,
        action: "delete",
        entity: "staffing_requirement",
        entityId: id,
        diff: row,
      });
    });
  },
);

export const createOverride = managerAction(
  staffingOverrideSchema,
  async (input, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(staffingOverrides)
        .values(input)
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "staffing_override",
        entityId: row.id,
        diff: row,
      });
    });
  },
);

export const updateOverride = managerAction(
  staffingOverrideSchema.and(idSchema),
  async ({ id, ...input }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(staffingOverrides)
        .where(eq(staffingOverrides.id, id));
      if (!before) throw new ActionError("Override not found.");
      await tx
        .update(staffingOverrides)
        .set(input)
        .where(eq(staffingOverrides.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "staffing_override",
        entityId: id,
        diff: changes(before, input),
      });
    });
  },
);

export const deleteOverride = managerAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(staffingOverrides)
      .where(eq(staffingOverrides.id, id))
      .returning();
    if (!row) throw new ActionError("Override not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "staffing_override",
      entityId: id,
      diff: row,
    });
  });
});
