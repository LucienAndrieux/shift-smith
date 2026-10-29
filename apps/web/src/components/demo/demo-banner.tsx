import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/server/session";

/** What the current role can do, and a way back to the start page. */
export function DemoBanner({ user }: { user: CurrentUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
      <span className="flex-1">
        {user.role === "manager"
          ? "Demo as a manager: every right on the shared demo data. Other visitors see your changes; everything is restored every night at 03:00."
          : user.role === "employee"
            ? `Demo as ${user.name} (employee): read the published schedules, your hours and absences, and send requests to the managers.`
            : "Read-only demo: browse the published schedules, the hour bank and the reference data."}
      </span>
      <Button size="sm" variant="outline" asChild>
        <Link href="/start">
          <ArrowLeftRight /> Change role
        </Link>
      </Button>
    </div>
  );
}
