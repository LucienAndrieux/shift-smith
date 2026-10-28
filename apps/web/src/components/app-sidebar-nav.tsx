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
  Shield,
  Timer,
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

const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Shield },
];

export function AppSidebarNav({ isAdmin }: { isAdmin: boolean }) {
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
      {group("Planning", MAIN)}
      {group("Setup", SETUP)}
      {isAdmin && group("Administration", ADMIN)}
    </>
  );
}
