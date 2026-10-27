"use server";

import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { sections, shiftTypePeriods, shiftTypes } from "@/db/schema";
import { validatePeriods } from "@/lib/domain/durations";
import {
  idSchema,
  sectionSchema,
  shiftTypeSchema,
} from "@/lib/schemas/reference";
import { ActionError, adminAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

export const updateSection = adminAction(
  sectionSchema.extend(idSchema.shape),
  async ({ id, ...values }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(sections)
        .where(eq(sections.id, id));
      if (!before) throw new ActionError("Section not found.");
      await tx.update(sections).set(values).where(eq(sections.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "section",
        entityId: id,
        diff: changes(before, values),
      });
    });
  },
);

function toPeriods(input: z.output<typeof shiftTypeSchema>) {
  const periods = input.periods
    .map((p) => ({
      startMinute: p.start,
      endMinute: p.end,
      unpaidBreakMinutes: p.unpaidBreakMinutes,
    }))
    .sort((a, b) => a.startMinute - b.startMinute);
  const errors = validatePeriods(periods);
  if (errors.length > 0) throw new ActionError(errors.join(" "));
  return periods;
}

export const createShiftType = adminAction(
  shiftTypeSchema,
  async (input, user) => {
    const periods = toPeriods(input);
    await db.transaction(async (tx) => {
      const { periods: _, ...values } = input;
      const [row] = await tx.insert(shiftTypes).values(values).returning();
      await tx.insert(shiftTypePeriods).values(
        periods.map((p, i) => ({
          ...p,
          shiftTypeId: row.id,
          position: i + 1,
        })),
      );
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "shift_type",
        entityId: row.id,
        diff: { ...values, periods },
      });
    });
  },
);

export const updateShiftType = adminAction(
  shiftTypeSchema.extend(idSchema.shape),
  async ({ id, ...input }, user) => {
    const periods = toPeriods(input);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(shiftTypes)
        .where(eq(shiftTypes.id, id));
      if (!before) throw new ActionError("Shift type not found.");
      const beforePeriods = await tx
        .select()
        .from(shiftTypePeriods)
        .where(eq(shiftTypePeriods.shiftTypeId, id));
      const { periods: _, sectionId: __, ...values } = input;
      await tx.update(shiftTypes).set(values).where(eq(shiftTypes.id, id));
      await tx
        .delete(shiftTypePeriods)
        .where(eq(shiftTypePeriods.shiftTypeId, id));
      await tx
        .insert(shiftTypePeriods)
        .values(
          periods.map((p, i) => ({ ...p, shiftTypeId: id, position: i + 1 })),
        );
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "shift_type",
        entityId: id,
        diff: {
          ...changes(before, values),
          periods: {
            from: beforePeriods.map(
              ({ startMinute, endMinute, unpaidBreakMinutes }) => ({
                startMinute,
                endMinute,
                unpaidBreakMinutes,
              }),
            ),
            to: periods,
          },
        },
      });
    });
  },
);

export const deleteShiftType = adminAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(shiftTypes)
      .where(eq(shiftTypes.id, id))
      .returning();
    if (!row) throw new ActionError("Shift type not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "shift_type",
      entityId: id,
      diff: row,
    });
  });
});
