"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  employeeFixedDaysOff,
  employeeRelations,
  employeeShiftEligibility,
  employees,
  employeeUnavailabilities,
  hourBankEntries,
} from "@/db/schema";
import {
  eligibilitySchema,
  employeeSchema,
  fixedDaysOffSchema,
  hourBankAdjustmentSchema,
  idSchema,
  relationSchema,
  unavailabilitySchema,
} from "@/lib/schemas/reference";
import { ActionError, adminAction } from "@/server/action";
import { audit, changes } from "@/server/audit";

function toEmployeeRow(v: z.output<typeof employeeSchema>) {
  const { weeklyContractHours, ...rest } = v;
  return {
    ...rest,
    weeklyContractMinutes: Math.round(weeklyContractHours * 60),
  };
}

export const createEmployee = adminAction(
  employeeSchema,
  async (input, user) => {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(employees)
        .values(toEmployeeRow(input))
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "employee",
        entityId: row.id,
        diff: row,
      });
      return { id: row.id };
    });
  },
);

export const updateEmployee = adminAction(
  employeeSchema.and(idSchema),
  async ({ id, ...input }, user) => {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(employees)
        .where(eq(employees.id, id));
      if (!before) throw new ActionError("Employee not found.");
      const values = toEmployeeRow(input);
      await tx.update(employees).set(values).where(eq(employees.id, id));
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "employee",
        entityId: id,
        diff: changes(before, values),
      });
    });
  },
);

export const setFixedDaysOff = adminAction(
  fixedDaysOffSchema,
  async ({ employeeId, first, second }, user) => {
    await db.transaction(async (tx) => {
      const before = await tx
        .select()
        .from(employeeFixedDaysOff)
        .where(eq(employeeFixedDaysOff.employeeId, employeeId));
      await tx
        .delete(employeeFixedDaysOff)
        .where(eq(employeeFixedDaysOff.employeeId, employeeId));
      const rows = [first, second]
        .filter((weekday) => weekday !== null)
        .map((weekday) => ({ employeeId, weekday }));
      if (rows.length > 0) await tx.insert(employeeFixedDaysOff).values(rows);
      await audit(tx, {
        userId: user.id,
        action: "update",
        entity: "employee_fixed_days_off",
        entityId: employeeId,
        diff: {
          from: before.map((b) => b.weekday),
          to: rows.map((r) => r.weekday),
        },
      });
    });
  },
);

export const upsertEligibility = adminAction(
  eligibilitySchema,
  async (input, user) => {
    await db.transaction(async (tx) => {
      const { employeeId, shiftTypeId, ...values } = input;
      await tx
        .insert(employeeShiftEligibility)
        .values(input)
        .onConflictDoUpdate({
          target: [
            employeeShiftEligibility.employeeId,
            employeeShiftEligibility.shiftTypeId,
          ],
          set: values,
        });
      await audit(tx, {
        userId: user.id,
        action: "upsert",
        entity: "employee_shift_eligibility",
        entityId: `${employeeId}:${shiftTypeId}`,
        diff: input,
      });
    });
  },
);

export const deleteEligibility = adminAction(
  z.object({ employeeId: z.uuid(), shiftTypeId: z.uuid() }),
  async ({ employeeId, shiftTypeId }, user) => {
    await db.transaction(async (tx) => {
      await tx
        .delete(employeeShiftEligibility)
        .where(
          and(
            eq(employeeShiftEligibility.employeeId, employeeId),
            eq(employeeShiftEligibility.shiftTypeId, shiftTypeId),
          ),
        );
      await audit(tx, {
        userId: user.id,
        action: "delete",
        entity: "employee_shift_eligibility",
        entityId: `${employeeId}:${shiftTypeId}`,
      });
    });
  },
);

export const createRelation = adminAction(
  relationSchema,
  async (input, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(employeeRelations)
        .values(input)
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "employee_relation",
        entityId: row.id,
        diff: input,
      });
    });
  },
);

export const deleteRelation = adminAction(idSchema, async ({ id }, user) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(employeeRelations)
      .where(eq(employeeRelations.id, id))
      .returning();
    if (!row) throw new ActionError("Relation not found.");
    await audit(tx, {
      userId: user.id,
      action: "delete",
      entity: "employee_relation",
      entityId: id,
      diff: row,
    });
  });
});

export const createUnavailability = adminAction(
  unavailabilitySchema,
  async ({ startTime, endTime, ...input }, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(employeeUnavailabilities)
        .values({
          ...input,
          startMinute: startTime,
          endMinute: endTime,
          source: "manual",
        })
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "employee_unavailability",
        entityId: row.id,
        diff: row,
      });
    });
  },
);

export const deleteUnavailability = adminAction(
  idSchema,
  async ({ id }, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(employeeUnavailabilities)
        .where(eq(employeeUnavailabilities.id, id))
        .returning();
      if (!row) throw new ActionError("Unavailability not found.");
      await audit(tx, {
        userId: user.id,
        action: "delete",
        entity: "employee_unavailability",
        entityId: id,
        diff: row,
      });
    });
  },
);

export const addHourBankAdjustment = adminAction(
  hourBankAdjustmentSchema,
  async ({ employeeId, entryDate, hours, note }, user) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(hourBankEntries)
        .values({
          employeeId,
          entryDate,
          minutes: Math.round(hours * 60),
          kind: "manual_adjustment",
          note,
          createdBy: user.id,
        })
        .returning();
      await audit(tx, {
        userId: user.id,
        action: "create",
        entity: "hour_bank_entry",
        entityId: row.id,
        diff: row,
      });
    });
  },
);
