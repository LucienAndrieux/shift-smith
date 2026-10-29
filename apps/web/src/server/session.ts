import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

/**
 * Showcase app: every visitor is an anonymous guest who picked a role on the
 * start page.
 * - manager: full rights on the shared data (restored every night);
 * - employee: plays one fictional employee, reads the published schedules and
 *   submits requests (constraints) for the managers to review;
 * - viewer: read-only.
 */
export type Role = "manager" | "employee" | "viewer";

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  /** The employee played by an `employee` guest. */
  employeeId: string | null;
}

/** The current visitor, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, role, employeeId } = session.user as typeof session.user & {
    employeeId?: string | null;
  };
  return {
    id,
    name,
    // "admin" and "demo" are the managers of earlier versions.
    role:
      role === "manager" || role === "admin" || role === "demo"
        ? "manager"
        : role === "employee" && employeeId
          ? "employee"
          : "viewer",
    employeeId: employeeId ?? null,
  };
});

/** Any visitor who entered the demo. Use in every page, action and route. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/start");
  return user;
}

export function isManager(user: CurrentUser): boolean {
  return user.role === "manager";
}

/** Manager: every mutation of shared data goes through this check. */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isManager(user)) redirect("/");
  return user;
}
