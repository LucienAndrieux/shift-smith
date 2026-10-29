import Link from "next/link";
import { Suspense } from "react";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { DemoBanner } from "@/components/demo/demo-banner";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { currentYearMonth } from "@/lib/dates";
import { getValidationCounts } from "@/server/queries/validation";
import { type Role, requireUser } from "@/server/session";

// Every route below reads the session (authorization), so none can be part of a
// static shell: opt out of instant-navigation validation for this segment.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        {/* Collapsed to icons, the logo and the toggle stack vertically. */}
        <SidebarHeader className="flex-row items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <Link
            href="/schedule"
            className="flex min-w-0 items-center gap-2 px-2 py-1.5 font-semibold"
          >
            <Logo />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              ShiftSmith
            </span>
          </Link>
          <SidebarTrigger className="hidden md:inline-flex" />
        </SidebarHeader>
        <SidebarContent>
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav />
          </Suspense>
        </SidebarContent>
        <SidebarFooter>
          {/* Just above the account block; stays visible when collapsed. */}
          <ThemeToggle align="start" />
          <Suspense>
            <SidebarUser />
          </Suspense>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        {/* Phones only: the sidebar is a drawer, opened from this bar. */}
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <Suspense fallback={null}>
            <GuestBanner />
          </Suspense>
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function GuestBanner() {
  return <DemoBanner user={await requireUser()} />;
}

async function SidebarNav() {
  const user = await requireUser();
  const counts = await getValidationCounts(user, currentYearMonth());
  return (
    <AppSidebarNav
      role={user.role}
      employeeId={user.employeeId}
      validationCounts={counts}
    />
  );
}

const ROLE_LABELS: Record<Role, string> = {
  manager: "manager",
  employee: "employee",
  viewer: "read-only",
};

async function SidebarUser() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-1 px-2 text-sm group-data-[collapsible=icon]:hidden">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{user.name}</span>
        <Badge variant={user.role === "manager" ? "default" : "secondary"}>
          {ROLE_LABELS[user.role]}
        </Badge>
      </div>
      <Link
        href="/start"
        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Change role
      </Link>
    </div>
  );
}

function NavSkeleton() {
  return (
    // Not SidebarMenuSkeleton: it uses Math.random(), which Cache Components rejects
    // in the prerendered shell.
    <div className="flex flex-col gap-2 p-3">
      {["w-24", "w-28", "w-20", "w-24", "w-28", "w-32", "w-20", "w-24"].map(
        (width, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <Skeleton key={i} className={`h-5 ${width}`} />
        ),
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
