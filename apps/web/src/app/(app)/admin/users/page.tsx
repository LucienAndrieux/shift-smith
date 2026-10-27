import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { user } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/session";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  // Demo guests are temporary and never managed here.
  const rows = await db
    .select()
    .from(user)
    .where(eq(user.isAnonymous, false))
    .orderBy(asc(user.createdAt));
  const approverName = new Map(rows.map((u) => [u.id, u.name]));

  return (
    <>
      <PageHeader
        title="Users"
        description="Approve access requests and manage roles. Approved viewers have read-only access."
      />
      <UsersTable
        currentUserId={me.id}
        users={rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role === "admin" ? "admin" : "viewer",
          accessStatus: u.accessStatus,
          createdAt: formatDateTime(u.createdAt),
          approvedAt: u.approvedAt ? formatDateTime(u.approvedAt) : null,
          approvedBy: u.approvedBy
            ? (approverName.get(u.approvedBy) ?? null)
            : null,
        }))}
      />
    </>
  );
}
