"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { employees, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentUser, type Role } from "@/server/session";

/**
 * Enters the demo (or changes role): creates an anonymous guest, or reuses the
 * current one, as a manager, an employee (playing `employeeId`) or read-only.
 * The caller then reloads the app: a redirect rendered in this same request
 * would still read the previous (possibly deleted) guest's session cookie.
 */
export async function enterDemo(role: Role, employeeId?: string) {
  let played: { id: string; name: string } | null = null;
  if (role === "employee") {
    const [row] = employeeId
      ? await db
          .select({ id: employees.id, name: employees.displayName })
          .from(employees)
          .where(
            and(eq(employees.id, employeeId), eq(employees.status, "active")),
          )
      : [];
    if (!row) throw new Error("Choose an employee to play.");
    played = row;
  }

  const current = await getCurrentUser();
  let id = current?.id;
  if (!id) {
    const result = await auth.api.signInAnonymous({
      headers: await headers(),
    });
    id = result?.user.id;
  }
  if (!id) throw new Error("Could not start the demo.");
  await db
    .update(user)
    .set({
      role,
      employeeId: played?.id ?? null,
      name:
        role === "manager"
          ? "Guest manager"
          : role === "employee"
            ? (played?.name ?? "Guest employee")
            : "Guest viewer",
    })
    .where(eq(user.id, id));
}
