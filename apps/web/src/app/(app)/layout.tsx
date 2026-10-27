import Link from "next/link";
import { Suspense } from "react";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { requireApprovedUser } from "@/server/session";

// Every route below reads the session (authorization), so none can be part of a
// static shell: opt out of instant-navigation validation for this segment.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href="/schedule"
            className="flex items-center gap-2 px-2 py-1.5 font-semibold"
          >
            <Logo />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              ShiftSmith
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav />
          </Suspense>
        </SidebarContent>
        <SidebarFooter>
          <Suspense>
            <SidebarUser />
          </Suspense>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function SidebarNav() {
  const user = await requireApprovedUser();
  return <AppSidebarNav isAdmin={user.role === "admin"} />;
}

async function SidebarUser() {
  const user = await requireApprovedUser();
  return (
    <div className="flex flex-col gap-1 px-2 text-sm group-data-[collapsible=icon]:hidden">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{user.name}</span>
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
          {user.role}
        </Badge>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {user.email}
      </span>
      <SignOutButton className="justify-start px-0" />
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
