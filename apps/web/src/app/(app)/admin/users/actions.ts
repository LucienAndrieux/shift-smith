"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { ActionError, adminAction } from "@/server/action";
import { audit } from "@/server/audit";
import { appUrl, sendEmail } from "@/server/email";

const idSchema = z.object({ userId: z.uuid() });

async function loadTarget(userId: string) {
  const [target] = await db.select().from(user).where(eq(user.id, userId));
  if (!target) throw new ActionError("User not found.");
  return target;
}

async function otherApprovedAdmins(userId: string) {
  return db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.role, "admin"),
        eq(user.accessStatus, "approved"),
        ne(user.id, userId),
      ),
    );
}

export const approveUser = adminAction(idSchema, async ({ userId }, admin) => {
  const target = await loadTarget(userId);
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        accessStatus: "approved",
        approvedAt: new Date(),
        approvedBy: admin.id,
      })
      .where(eq(user.id, userId));
    await audit(tx, {
      userId: admin.id,
      action: "approve",
      entity: "user",
      entityId: userId,
      diff: { accessStatus: { from: target.accessStatus, to: "approved" } },
    });
  });
  await sendEmail({
    to: target.email,
    subject: "Your access to ShiftSmith was approved",
    text: `Hello ${target.name},\n\nYour access request was approved. You can now log in:\n${appUrl("/sign-in")}`,
  });
});

export const rejectUser = adminAction(idSchema, async ({ userId }, admin) => {
  const target = await loadTarget(userId);
  if (userId === admin.id) throw new ActionError("You cannot reject yourself.");
  if (
    target.role === "admin" &&
    (await otherApprovedAdmins(userId)).length === 0
  ) {
    throw new ActionError("At least one approved admin must remain.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ accessStatus: "rejected", approvedAt: null, approvedBy: admin.id })
      .where(eq(user.id, userId));
    await audit(tx, {
      userId: admin.id,
      action: "reject",
      entity: "user",
      entityId: userId,
      diff: { accessStatus: { from: target.accessStatus, to: "rejected" } },
    });
  });
  await sendEmail({
    to: target.email,
    subject: "Your access request to ShiftSmith",
    text: `Hello ${target.name},\n\nYour access request was declined. Contact the hotel if you think this is a mistake.`,
  });
});

export const setUserRole = adminAction(
  idSchema.extend({ role: z.enum(["admin", "viewer"]) }),
  async ({ userId, role }, admin) => {
    const target = await loadTarget(userId);
    if (target.role === role) return;
    if (role === "viewer" && (await otherApprovedAdmins(userId)).length === 0) {
      throw new ActionError("At least one approved admin must remain.");
    }
    await db.transaction(async (tx) => {
      await tx.update(user).set({ role }).where(eq(user.id, userId));
      await audit(tx, {
        userId: admin.id,
        action: "update",
        entity: "user",
        entityId: userId,
        diff: { role: { from: target.role, to: role } },
      });
    });
  },
);
