"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { holidaySchema, idSchema } from "@/lib/schemas/reference";
import { ActionError, adminAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

export const createHoliday = adminAction(holidaySchema, async (input, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(holidays).values(input).returning();
    await audit(tx, {
      userId: user.id,
      action: "create",
      entity: "holiday",
      entityId: row.id,
      diff: row,
    });
  });
});

export const updateHoliday = adminAction(
  holidaySchema.extend(idSchema.shape),
  async ({ id, ...input }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(holidays)
        .where(eq(holidays.id, id));
      if (!before) throw new ActionError("Holiday not found.");
      await tx.update(holidays).set(input).where(eq(holidays.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "holiday",
        entityId: id,
        diff: changes(before, input),
      });
    });
  },
);

export const deleteHoliday = adminAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(holidays)
      .where(eq(holidays.id, id))
      .returning();
    if (!row) throw new ActionError("Holiday not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "holiday",
      entityId: id,
      diff: row,
    });
  });
});
