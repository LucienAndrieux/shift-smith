"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { type AppColumnDef, DataTable } from "@/components/data-table";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import { Badge } from "@/components/ui/badge";
import { weekdayShort } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export interface EmployeeListRow {
  id: string;
  name: string;
  employeeNumber: string | null;
  section: string;
  sectionOrder: number;
  status: "active" | "inactive";
  weeklyContractMinutes: number;
  reducedSchedule: boolean;
  fixedDaysOff: { weekday: number }[];
  monthlyTlDays: number;
  requiresMonthlyWeekendOff: boolean;
  toConfirm: boolean;
  balanceMinutes: number;
}

const columns: AppColumnDef<EmployeeListRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/employees/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        {row.original.status === "inactive" && (
          <Badge variant="secondary">Inactive</Badge>
        )}
        <ToConfirmBadge show={row.original.toConfirm} />
      </div>
    ),
  },
  {
    id: "section",
    accessorFn: (row) => row.section,
    header: "Section",
    sortFn: (a, b) => a.original.sectionOrder - b.original.sectionOrder,
  },
  {
    id: "contract",
    accessorFn: (row) => row.weeklyContractMinutes,
    header: "Contract",
    cell: ({ row }) => (
      <span>
        {row.original.weeklyContractMinutes / 60}h/week
        {row.original.reducedSchedule && (
          <Badge variant="outline" className="ml-2">
            Reduced
          </Badge>
        )}
      </span>
    ),
  },
  {
    id: "daysOff",
    header: "Fixed days off",
    enableSorting: false,
    accessorFn: (row) =>
      row.fixedDaysOff.map((f) => weekdayShort(f.weekday as 1)).join(" "),
    cell: ({ row }) =>
      row.original.fixedDaysOff.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="whitespace-nowrap">
          {row.original.fixedDaysOff
            .map((f) => weekdayShort(f.weekday as 1))
            .join(" · ")}
        </span>
      ),
  },
  { accessorKey: "monthlyTlDays", header: "TL / month" },
  {
    accessorKey: "requiresMonthlyWeekendOff",
    header: "Weekend off",
    enableGlobalFilter: false,
    cell: ({ row }) =>
      row.original.requiresMonthlyWeekendOff ? (
        <Check className="size-4" aria-label="Yes" />
      ) : null,
  },
  {
    accessorKey: "balanceMinutes",
    header: "Hour bank",
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <span
        className={cn(
          "font-mono tabular-nums",
          row.original.balanceMinutes < 0 && "text-destructive",
        )}
      >
        {formatHoursMinutes(row.original.balanceMinutes, true)}
      </span>
    ),
  },
];

export function EmployeesTable({ rows }: { rows: EmployeeListRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search employees…"
      initialSorting={[{ id: "section", desc: false }]}
      rowClassName={(row) =>
        row.status === "inactive" ? "opacity-60" : undefined
      }
    />
  );
}
