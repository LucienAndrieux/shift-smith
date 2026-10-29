import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RoleChooser } from "@/components/demo/role-chooser";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployees } from "@/server/queries/reference";

export const metadata: Metadata = { title: "Try the demo" };

export default function StartPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Chooser />
    </Suspense>
  );
}

async function Chooser() {
  // Request time: the demo restore re-creates the employees (new ids).
  await connection();
  const employees = (await getEmployees())
    .filter((e) => e.status === "active")
    .sort(
      (a, b) =>
        a.sectionSortOrder - b.sectionSortOrder ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((e) => ({ id: e.id, name: e.displayName, section: e.sectionName }));
  return <RoleChooser employees={employees} />;
}
