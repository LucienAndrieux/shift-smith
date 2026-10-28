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
import { formatDayMonth } from "@/lib/domain/calendar";
import { violationIdentity } from "@/lib/domain/validator";
import { cn } from "@/lib/utils";
import { FixDialog } from "./fix-dialog";
import type { View, ViewIndex } from "./types";

type Severity = "error" | "warning";

/**
 * Violations of a version: one collapsible block for the errors, then one for the
 * warnings, each listing location, date and description, with a Fix button on
 * every line when the version is editable.
 */
export function ValidationPanel({
  view,
  index,
  canEdit,
}: {
  view: View;
  index: ViewIndex;
  /** The version is editable by this user: shows the "Fix" buttons. */
  canEdit: boolean;
}) {
  const [open, setOpen] = useState<Set<Severity>>(new Set(["error"]));
  const toggle = (severity: Severity) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });

  const readOnlyHint =
    !canEdit && view.schedule ? (
      <p className="text-sm text-muted-foreground">
        To use Fix, open a draft you can edit (duplicate this version from the
        schedule page if needed).
      </p>
    ) : null;

  const blocks: { severity: Severity; title: string }[] = [
    { severity: "error", title: "Errors" },
    { severity: "warning", title: "Warnings" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {readOnlyHint}
      {blocks.map(({ severity, title }) => {
        const items = view.violations
          .filter((v) => v.severity === severity)
          .toSorted((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        const expanded = open.has(severity);
        const showFix = canEdit && view.schedule !== null;
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
                        {showFix && <TableHead className="w-16" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((v, i) => (
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
                              : (v.weekKey ?? "Month")}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {v.message}
                          </TableCell>
                          {showFix && view.schedule && (
                            <TableCell className="text-right">
                              <FixDialog
                                scheduleId={view.schedule.id}
                                violation={violationIdentity(v)}
                                message={v.message}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
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
