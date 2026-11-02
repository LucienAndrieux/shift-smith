"use client";

import { Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { type AppColumnDef, DataTable } from "@/components/data-table";
import type { Option } from "@/components/form/fields";
import { useT } from "@/components/i18n-provider";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { diffDays } from "@/lib/domain/calendar";
import { AbsenceDialog } from "./absence-dialog";
import { DeleteAbsenceButton } from "./delete-absence-button";

export interface AbsenceListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  dayCode: string;
  startDate: string;
  endDate: string;
  status: "approved" | "cancelled";
  source: "import" | "manual" | "constraint";
  endToConfirm: boolean;
  note: string | null;
}

const ALL = "__all__";

export function AbsencesView({
  rows,
  employees,
  codes,
  canManage,
}: {
  rows: AbsenceListRow[];
  employees: Option[];
  codes: Option[];
  canManage: boolean;
}) {
  const t = useT();
  const a = t.absences;
  const [employee, setEmployee] = useState(ALL);
  const [code, setCode] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (employee === ALL || r.employeeId === employee) &&
          (code === ALL || r.dayCode === code) &&
          // Overlap with the [from, to] period.
          (!from || r.endDate >= from) &&
          (!to || r.startDate <= to),
      ),
    [rows, employee, code, from, to],
  );

  const columns = useMemo<AppColumnDef<AbsenceListRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: a.employee,
        cell: ({ row }) => (
          <Link
            href={`/employees/${row.original.employeeId}`}
            className="hover:underline"
          >
            {row.original.employeeName}
          </Link>
        ),
      },
      {
        accessorKey: "dayCode",
        header: a.code,
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.dayCode}</Badge>
        ),
      },
      { accessorKey: "startDate", header: a.from },
      {
        accessorKey: "endDate",
        header: a.to,
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            {row.original.endDate}
            <ToConfirmBadge show={row.original.endToConfirm} />
          </span>
        ),
      },
      {
        id: "days",
        header: a.days,
        accessorFn: (r) => diffDays(r.startDate, r.endDate) + 1,
      },
      {
        accessorKey: "status",
        header: a.status,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "approved" ? "secondary" : "outline"
            }
          >
            {a.statuses[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "source",
        header: a.source,
        cell: ({ row }) => a.sources[row.original.source],
      },
      { accessorKey: "note", header: a.note, enableSorting: false },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              enableSorting: false,
              enableGlobalFilter: false,
              cell: ({ row }) => (
                <span className="flex justify-end">
                  <AbsenceDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={a.editLabel}
                      >
                        <Pencil />
                      </Button>
                    }
                    absence={row.original}
                    employees={employees}
                    codes={codes}
                  />
                  <DeleteAbsenceButton id={row.original.id} />
                </span>
              ),
            } satisfies AppColumnDef<AbsenceListRow>,
          ]
        : []),
    ],
    [canManage, employees, codes, a],
  );

  const hasFilters = employee !== ALL || code !== ALL || from || to;

  return (
    <DataTable
      columns={columns}
      data={filtered}
      empty={a.noMatch}
      rowClassName={(r) =>
        r.status === "cancelled" ? "opacity-50" : undefined
      }
      toolbar={
        <>
          <FilterSelect
            value={employee}
            onChange={setEmployee}
            options={employees}
            allLabel={a.allEmployees}
          />
          <FilterSelect
            value={code}
            onChange={setCode}
            options={codes}
            allLabel={a.allCodes}
          />
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label={a.from}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
            aria-label={a.to}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmployee(ALL);
                setCode(ALL);
                setFrom("");
                setTo("");
              }}
            >
              <X /> {a.clear}
            </Button>
          )}
          <div className="flex-1" />
          {canManage && (
            <AbsenceDialog
              trigger={
                <Button size="sm">
                  <Plus /> {a.new}
                </Button>
              }
              employees={employees}
              codes={codes}
            />
          )}
        </>
      }
    />
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
