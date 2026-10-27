"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { deleteGuestWork } from "@/server/demo/guests";
import { getCurrentUser } from "@/server/session";

export type DemoMode = "manager" | "viewer";

/**
 * Enters the public demo without an account: creates an anonymous guest (or reuses
 * the current one) as a demo manager or a read-only viewer.
 */
export async function enterDemo(mode: DemoMode) {
  if (!env().DEMO_MODE) throw new Error("The demo is not enabled.");
  const current = await getCurrentUser();
  if (current && !current.isGuest) redirect("/schedule");

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
    .set(
      mode === "manager"
        ? { role: "demo", name: "Guest manager" }
        : { role: "viewer", name: "Guest viewer" },
    )
    .where(eq(user.id, id));
  redirect("/schedule");
}

/** Deletes the current guest's drafts, generations and constraints. */
export async function resetMyDemo() {
  const current = await getCurrentUser();
  if (!current?.isGuest) throw new Error("Only demo guests can reset.");
  await deleteGuestWork([current.id]);
  redirect("/schedule");
}
