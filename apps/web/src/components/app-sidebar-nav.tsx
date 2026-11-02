"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Gauge,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  PartyPopper,
  Plane,
  Scale,
  Timer,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Role } from "@/server/session";
import { useT } from "./i18n-provider";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefix used for the active state when it differs from href. */
  match?: string;
  /** Guided-tour target (`components/guided-tour.tsx`). */
  tour?: string;
}

type Nav = Dictionary["nav"];

const main = (t: Nav): NavItem[] => [
  { href: "/schedule", label: t.schedule, icon: CalendarDays },
  {
    href: "/validation",
    label: t.validation,
    icon: ListChecks,
    tour: "nav-validation",
  },
  { href: "/hours", label: t.hours, icon: Clock3 },
  { href: "/employees", label: t.employees, icon: Users },
  { href: "/absences", label: t.absences, icon: Plane },
  { href: "/hour-bank", label: t.hourBank, icon: Timer },
  {
    href: "/constraints",
    label: t.constraints,
    icon: MessageSquareText,
    tour: "nav-constraints",
  },
];

const setup = (t: Nav): NavItem[] => [
  { href: "/sections", label: t.sections, icon: ClipboardList },
  { href: "/staffing", label: t.staffing, icon: Gauge },
  { href: "/rules", label: t.rules, icon: Scale },
  { href: "/holidays", label: t.holidays, icon: PartyPopper },
];

/** An employee guest: their own pages first, then the shared schedule views. */
const employeeNav = (t: Nav, employeeId: string): NavItem[] => [
  { href: "/schedule", label: t.schedule, icon: CalendarDays },
  {
    href: `/employees/${employeeId}`,
    label: t.myProfile,
    icon: UserRound,
    tour: "nav-profile",
  },
  { href: "/hours", label: t.hours, icon: Clock3 },
  {
    href: "/constraints",
    label: t.myRequests,
    icon: MessageSquareText,
    tour: "nav-requests",
  },
];

/** Red / orange counters, same colours as the Errors and Warnings blocks. */
function ValidationCounts({
  errors,
  warnings,
}: {
  errors: number;
  warnings: number;
}) {
  const t = useT();
  if (errors === 0 && warnings === 0) return null;
  const dot =
    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white tabular-nums";
  return (
    <span className="ml-auto flex items-center gap-1 group-data-[collapsible=icon]:hidden">
      {errors > 0 && (
        <span className={`${dot} bg-destructive`} title={t.nav.errors(errors)}>
          {errors}
        </span>
      )}
      {warnings > 0 && (
        <span
          className={`${dot} bg-amber-500`}
          title={t.nav.warnings(warnings)}
        >
          {warnings}
        </span>
      )}
    </span>
  );
}

export function AppSidebarNav({
  role,
  employeeId,
  validationCounts,
}: {
  role: Role;
  employeeId: string | null;
  /** Errors and warnings of the Validation page (current and upcoming months). */
  validationCounts: { errors: number; warnings: number };
}) {
  const { nav } = useT();
  const pathname = usePathname();
  const group = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const prefix = item.match ?? item.href;
            const active =
              pathname === prefix || pathname.startsWith(`${prefix}/`);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  // The active page wears the logo's ember: tinted row, orange icon.
                  className="data-[active=true]:bg-brand/10 data-[active=true]:text-foreground [&[data-active=true]>svg]:text-brand"
                >
                  <Link href={item.href} data-tour={item.tour}>
                    <item.icon />
                    <span>{item.label}</span>
                    {item.href === "/validation" && (
                      <ValidationCounts {...validationCounts} />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <>
      {role === "employee" && employeeId ? (
        group(nav.planning, employeeNav(nav, employeeId))
      ) : (
        <>
          {group(nav.planning, main(nav))}
          {group(nav.setup, setup(nav))}
        </>
      )}
    </>
  );
}
