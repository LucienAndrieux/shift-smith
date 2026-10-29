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
import type { Role } from "@/server/session";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefix used for the active state when it differs from href. */
  match?: string;
}

const MAIN: NavItem[] = [
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/validation", label: "Validation", icon: ListChecks },
  { href: "/hours", label: "Hours", icon: Clock3 },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/absences", label: "Absences", icon: Plane },
  { href: "/hour-bank", label: "Hour bank", icon: Timer },
  { href: "/constraints", label: "Constraints", icon: MessageSquareText },
];

const SETUP: NavItem[] = [
  { href: "/sections", label: "Sections & shifts", icon: ClipboardList },
  { href: "/staffing", label: "Staffing", icon: Gauge },
  { href: "/rules", label: "Rules", icon: Scale },
  { href: "/holidays", label: "Holidays", icon: PartyPopper },
];

/** An employee guest: their own pages first, then the shared schedule views. */
const employeeNav = (employeeId: string): NavItem[] => [
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: `/employees/${employeeId}`, label: "My profile", icon: UserRound },
  { href: "/hours", label: "Hours", icon: Clock3 },
  { href: "/constraints", label: "My requests", icon: MessageSquareText },
];

/** Red / orange counters, same colours as the Errors and Warnings blocks. */
function ValidationCounts({
  errors,
  warnings,
}: {
  errors: number;
  warnings: number;
}) {
  if (errors === 0 && warnings === 0) return null;
  const dot =
    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white tabular-nums";
  return (
    <span className="ml-auto flex items-center gap-1 group-data-[collapsible=icon]:hidden">
      {errors > 0 && (
        <span className={`${dot} bg-destructive`} title={`${errors} error(s)`}>
          {errors}
        </span>
      )}
      {warnings > 0 && (
        <span
          className={`${dot} bg-amber-500`}
          title={`${warnings} warning(s)`}
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
                <SidebarMenuButton asChild isActive={active}>
                  <Link href={item.href}>
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
        group("Planning", employeeNav(employeeId))
      ) : (
        <>
          {group("Planning", MAIN)}
          {group("Setup", SETUP)}
        </>
      )}
    </>
  );
}
