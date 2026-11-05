"use server";

import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { sections, shiftTypePeriods, shiftTypes } from "@/db/schema";
import { validatePeriods } from "@/lib/domain/durations";
import { translateMessage } from "@/lib/i18n/messages";
import {
  idSchema,
  sectionSchema,
  shiftTypeSchema,
} from "@/lib/schemas/reference";
import { ActionError, managerAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

/** Stable code from the name ("Spa & Wellness" → "spa-wellness"), unique. */
function sectionCode(name: string, taken: Set<string>): string {
  const base =
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let code = base;
  for (let n = 2; taken.has(code); n++) code = `${base}-${n}`;
  return code;
}

export const createSection = managerAction(
  sectionSchema,
  async (values, user) => {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ code: sections.code, name: sections.name })
        .from(sections);
      const name = values.name.trim();
      if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase()))
        throw new ActionError((t) => t.common.alreadyExists(name));
      const code = sectionCode(name, new Set(existing.map((s) => s.code)));
      const [row] = await tx
        .insert(sections)
        .values({ ...values, name, code })
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "section",
        entityId: row.id,
        diff: row,
      });
    });
  },
);

export const updateSection = managerAction(
  sectionSchema.extend(idSchema.shape),
  async ({ id, ...values }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(sections)
        .where(eq(sections.id, id));
      if (!before) throw new ActionError((t) => t.errors.sectionNotFound);
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
  if (errors.length > 0) {
    throw new ActionError((t) =>
      errors.map((e) => translateMessage(t, e)).join(" "),
    );
  }
  return periods;
}

export const createShiftType = managerAction(
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

export const updateShiftType = managerAction(
  shiftTypeSchema.extend(idSchema.shape),
  async ({ id, ...input }, user) => {
    const periods = toPeriods(input);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(shiftTypes)
        .where(eq(shiftTypes.id, id));
      if (!before) throw new ActionError((t) => t.errors.shiftTypeNotFound);
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

export const deleteShiftType = managerAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(shiftTypes)
      .where(eq(shiftTypes.id, id))
      .returning();
    if (!row) throw new ActionError((t) => t.errors.shiftTypeNotFound);
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "shift_type",
      entityId: id,
      diff: row,
    });
  });
});
