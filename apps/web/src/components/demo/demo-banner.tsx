import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/server/session";

/** What the current role can do, and a way back to the start page. */
export function DemoBanner({ user }: { user: CurrentUser }) {
  return (
    // Same pill as the start page's "Live demo" line: frosted card, status dot.
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/70 px-4 py-2.5 text-sm shadow-xs backdrop-blur">
      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="flex-1 text-muted-foreground">
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
