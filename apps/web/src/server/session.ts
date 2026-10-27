import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
  accessStatus: "pending" | "approved" | "rejected";
}

/** The signed-in user, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, role, accessStatus } = session.user;
  return {
    id,
    name,
    email,
    role: role === "admin" ? "admin" : "viewer",
    accessStatus:
      accessStatus === "approved" || accessStatus === "rejected"
        ? accessStatus
        : "pending",
  };
});

/** Any signed-in user (pending ones included). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Signed-in and approved by an admin: read access to the whole app except /admin. */
export async function requireApprovedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.accessStatus !== "approved") redirect("/pending");
  return user;
}

/** Approved admin. Use in every admin page, Server Action and Route Handler. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireApprovedUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
