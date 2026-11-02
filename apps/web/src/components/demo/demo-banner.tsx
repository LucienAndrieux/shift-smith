import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { GuidedTour } from "@/components/guided-tour";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import type { CurrentUser } from "@/server/session";

/** What the current role can do, its guided tour and a way back to the start page. */
export async function DemoBanner({ user }: { user: CurrentUser }) {
  const t = await getT();
  return (
    // Same pill as the start page's "Live demo" line: frosted card, status dot.
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/70 px-4 py-2.5 text-sm shadow-xs backdrop-blur">
      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="flex-1 text-muted-foreground">
        {user.role === "manager"
          ? t.shell.bannerManager
          : user.role === "employee"
            ? t.shell.bannerEmployee(user.name)
            : t.shell.bannerViewer}
      </span>
      <div data-tour="tour-actions" className="flex flex-wrap gap-2">
        <GuidedTour role={user.role} userId={user.id} />
        <Button size="sm" variant="outline" asChild>
          <Link href="/start">
            <ArrowLeftRight /> {t.shell.changeRole}
          </Link>
        </Button>
      </div>
    </div>
  );
}
