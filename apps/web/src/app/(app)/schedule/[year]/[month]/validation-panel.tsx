"use client";

import { AlertTriangle, ChevronRight, OctagonAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayMonth, MONTH_NAMES } from "@/lib/domain/calendar";
import { violationIdentity } from "@/lib/domain/validator";
import { cn } from "@/lib/utils";
import { FixDialog } from "./fix-dialog";
import type { View, ViewIndex } from "./types";

type Severity = "error" | "warning";

/** One schedule version checked by the panel (one per month on /validation). */
export interface ValidationSource {
  view: View;
  index: ViewIndex;
  /** The version is editable by this user: shows its "Fix" buttons. */
  canEdit: boolean;
}

/**
 * Violations of one or several versions: one collapsible block for the errors,
 * then one for the warnings, each listing location, date and description in date
 * order, with a Fix button on every line of an editable version.
 */
export function ValidationPanel({
  sources,
  canPlan,
}: {
  sources: ValidationSource[];
  /** Admin or demo manager: every line gets a Fix button. */
  canPlan: boolean;
}) {
  const [open, setOpen] = useState<Set<Severity>>(new Set(["error"]));
  const toggle = (severity: Severity) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });

  const rows = sources.flatMap((source) =>
    source.view.violations.map((v) => ({
      v,
      source,
      // Month-level violations sort at the start of their month.
      sortKey:
        v.date ??
        `${source.view.year}-${String(source.view.month).padStart(2, "0")}-00`,
    })),
  );

  const blocks: { severity: Severity; title: string }[] = [
    { severity: "error", title: "Errors" },
    { severity: "warning", title: "Warnings" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {blocks.map(({ severity, title }) => {
        const items = rows
          .filter((r) => r.v.severity === severity)
          .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
        const expanded = open.has(severity);
        return (
          <section
            key={severity}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(severity)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-90",
                )}
              />
              {severity === "error" ? (
                <OctagonAlert className="size-4 text-destructive" />
              ) : (
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="flex-1 font-medium">{title}</span>
              <Badge
                variant={severity === "error" ? "destructive" : "outline"}
                className={cn(
                  severity === "warning" &&
                    "border-amber-500/60 text-amber-700 dark:text-amber-400",
                )}
              >
                {items.length}
              </Badge>
            </button>
            {expanded &&
              (items.length === 0 ? (
                <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                  Nothing to report.
                </p>
              ) : (
                <div className="max-h-[32rem] overflow-auto border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        {canPlan && <TableHead className="w-16" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(({ v, source }, i) => {
                        const { view, index, canEdit } = source;
                        return (
                          // biome-ignore lint/suspicious/noArrayIndexKey: violations have no id
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap">
                              {v.employeeId
                                ? index.employeeById.get(v.employeeId)?.name
                                : (index.sectionById.get(v.sectionId ?? "")
                                    ?.name ?? "—")}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {v.date
                                ? formatDayMonth(v.date)
                                : (v.weekKey ??
                                  `${MONTH_NAMES[view.month - 1].slice(0, 3)} ${view.year}`)}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              {v.message}
                            </TableCell>
                            {canPlan && (
                              <TableCell className="text-right">
                                {view.schedule && (
                                  <FixDialog
                                    scheduleId={view.schedule.id}
                                    scheduleStatus={view.schedule.status}
                                    editable={canEdit}
                                    canApplyToPublished={
                                      view.schedule.status === "published" &&
                                      view.schedule.closedAt === null
                                    }
                                    violation={violationIdentity(v)}
                                    message={v.message}
                                  />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
