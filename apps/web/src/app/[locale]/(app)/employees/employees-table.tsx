"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { type AppColumnDef, DataTable } from "@/components/data-table";
import { useLocale, useT } from "@/components/i18n-provider";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import { Badge } from "@/components/ui/badge";
import { weekdayShort } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
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

const buildColumns = (
  t: Dictionary["employees"],
  locale: Locale,
): AppColumnDef<EmployeeListRow>[] => [
  {
    accessorKey: "name",
    header: t.name,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/employees/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        {row.original.status === "inactive" && (
          <Badge variant="secondary">{t.inactive}</Badge>
        )}
        <ToConfirmBadge show={row.original.toConfirm} />
      </div>
    ),
  },
  {
    id: "section",
    accessorFn: (row) => row.section,
    header: t.section,
    sortFn: (a, b) => a.original.sectionOrder - b.original.sectionOrder,
  },
  {
    id: "contract",
    accessorFn: (row) => row.weeklyContractMinutes,
    header: t.contract,
    cell: ({ row }) => (
      <span>
        {t.perWeek(row.original.weeklyContractMinutes / 60)}
        {row.original.reducedSchedule && (
          <Badge variant="outline" className="ml-2">
            {t.reduced}
          </Badge>
        )}
      </span>
    ),
  },
  {
    id: "daysOff",
    header: t.fixedDaysOff,
    enableSorting: false,
    accessorFn: (row) =>
      row.fixedDaysOff
        .map((f) => weekdayShort(f.weekday as 1, locale))
        .join(" "),
    cell: ({ row }) =>
      row.original.fixedDaysOff.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="whitespace-nowrap">
          {row.original.fixedDaysOff
            .map((f) => weekdayShort(f.weekday as 1, locale))
            .join(" · ")}
        </span>
      ),
  },
  { accessorKey: "monthlyTlDays", header: t.tlPerMonth },
  {
    accessorKey: "requiresMonthlyWeekendOff",
    header: t.weekendOff,
    enableGlobalFilter: false,
    cell: ({ row }) =>
      row.original.requiresMonthlyWeekendOff ? (
        <Check className="size-4" aria-label={t.yes} />
      ) : null,
  },
  {
    accessorKey: "balanceMinutes",
    header: t.hourBank,
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
  const t = useT();
  const locale = useLocale();
  const columns = useMemo(() => buildColumns(t.employees, locale), [t, locale]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder={t.employees.search}
      initialSorting={[{ id: "section", desc: false }]}
      rowClassName={(row) =>
        row.status === "inactive" ? "opacity-60" : undefined
      }
    />
  );
}
