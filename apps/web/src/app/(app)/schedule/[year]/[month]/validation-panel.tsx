"use client";

import {
  AlertTriangle,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  OctagonAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDayMonth, isoWeeksOfMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import {
  VIOLATION_LABELS,
  type ViolationCode,
  violationIdentity,
} from "@/lib/domain/validator";
import { cn } from "@/lib/utils";
import { FixDialog } from "./fix-dialog";
import type { View, ViewIndex } from "./types";

export function ValidationPanel({
  view,
  index,
  sectionId,
  canEdit,
}: {
  view: View;
  index: ViewIndex;
  sectionId: string | null;
  /** Admin on an editable version: shows the "Fix" buttons. */
  canEdit: boolean;
}) {
  const [severity, setSeverity] = useState<"error" | "warning" | "all">(
    "error",
  );
  // Violations of the section selected above the grid (all when null).
  const sectionViolations = useMemo(
    () =>
      view.violations.filter(
        (v) =>
          !sectionId ||
          v.sectionId === sectionId ||
          (v.employeeId !== null &&
            index.employeeById.get(v.employeeId)?.sectionId === sectionId),
      ),
    [view.violations, sectionId, index],
  );
  const errorCount = sectionViolations.filter(
    (v) => v.severity === "error",
  ).length;
  const warningCount = sectionViolations.length - errorCount;
  const groups = useMemo(
    () =>
      groupByRule(
        sectionViolations.filter(
          (v) => severity === "all" || v.severity === severity,
        ),
      ),
    [sectionViolations, severity],
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (code: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const sectionName = sectionId ? index.sectionById.get(sectionId)?.name : null;
  const weeks = isoWeeksOfMonth(view.year, view.month);
  const employees = view.employees.filter(
    (e) => !sectionId || e.sectionId === sectionId,
  );
  const totals = new Map(view.totals.map((t) => [t.employeeId, t]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          Validation
          <span className="font-normal text-muted-foreground">
            · {sectionName ?? "All sections"}
          </span>
          {errorCount === 0 ? (
            <Badge variant="secondary">
              <CircleCheck /> No hard-rule violations
            </Badge>
          ) : (
            <Badge variant="destructive">
              <OctagonAlert /> {errorCount} error(s)
            </Badge>
          )}
          <Badge variant="outline">
            <AlertTriangle /> {warningCount} warning(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="violations">
          <TabsList>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
          </TabsList>

          <TabsContent value="violations" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={severity}
                onValueChange={(v) => v && setSeverity(v as typeof severity)}
              >
                <ToggleGroupItem value="error">
                  Errors ({errorCount})
                </ToggleGroupItem>
                <ToggleGroupItem value="warning">
                  Warnings ({warningCount})
                </ToggleGroupItem>
                <ToggleGroupItem value="all">
                  All ({sectionViolations.length})
                </ToggleGroupItem>
              </ToggleGroup>
              {groups.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(new Set(groups.map((g) => g.code)))}
                  >
                    <ChevronsUpDown /> Expand all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(new Set())}
                  >
                    <ChevronsDownUp /> Collapse all
                  </Button>
                </div>
              )}
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to report.
              </p>
            ) : (
              <div className="flex flex-col divide-y overflow-hidden rounded-md border">
                {groups.map((group) => {
                  const expanded = open.has(group.code);
                  return (
                    <section key={group.code}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggle(group.code)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-90",
                          )}
                        />
                        <span className="flex-1 font-medium">
                          {VIOLATION_LABELS[group.code]}
                        </span>
                        {group.errors > 0 && (
                          <Badge variant="destructive">{group.errors}</Badge>
                        )}
                        {group.warnings > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/60 text-amber-700 dark:text-amber-400"
                          >
                            {group.warnings}
                          </Badge>
                        )}
                      </button>
                      {expanded && (
                        <div className="max-h-96 overflow-auto border-t bg-muted/20">
                          <Table>
                            <TableBody>
                              {group.items.map((v, i) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: violations have no id
                                <TableRow key={i}>
                                  <TableCell>
                                    <span
                                      className={cn(
                                        "inline-block size-2 rounded-full",
                                        v.severity === "error"
                                          ? "bg-red-500"
                                          : "bg-amber-500",
                                      )}
                                      title={v.severity}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {v.employeeId
                                      ? index.employeeById.get(v.employeeId)
                                          ?.name
                                      : (index.sectionById.get(
                                          v.sectionId ?? "",
                                        )?.name ?? "—")}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {v.date
                                      ? formatDayMonth(v.date)
                                      : (v.weekKey ?? "Month")}
                                  </TableCell>
                                  <TableCell className="whitespace-normal">
                                    {v.message}
                                  </TableCell>
                                  {canEdit && view.schedule && (
                                    <TableCell className="w-16 text-right">
                                      {v.severity === "error" && (
                                        <FixDialog
                                          scheduleId={view.schedule.id}
                                          violation={violationIdentity(v)}
                                          message={v.message}
                                        />
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="hours">
            <p className="mb-2 text-sm text-muted-foreground">
              Expected = daily contract × (shift days + due days). Credited =
              daily contract × days whose code credits time. TL is due but
              credits nothing. Week columns show (worked + credited) / expected.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Worked</TableHead>
                    <TableHead className="text-right">Credited</TableHead>
                    <TableHead className="text-right">Δ month</TableHead>
                    {weeks.map((w) => (
                      <TableHead key={w.key} className="text-right">
                        {w.key.slice(5)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => {
                    const t = totals.get(e.id);
                    if (!t) return null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap">
                          {e.name}
                          {t.month.unassignedDays > 0 && (
                            <Badge variant="outline" className="ml-2">
                              {t.month.unassignedDays} empty
                            </Badge>
                          )}
                        </TableCell>
                        <Num value={t.month.expectedMinutes} />
                        <Num value={t.month.workedMinutes} />
                        <Num value={t.month.creditedMinutes} />
                        <Num value={t.month.deltaMinutes} signed />
                        {t.weeks.map((w) => {
                          const done = w.workedMinutes + w.creditedMinutes;
                          return (
                            <TableCell
                              key={w.weekKey}
                              className={cn(
                                "text-right font-mono text-xs whitespace-nowrap",
                                w.isPartial && "text-muted-foreground",
                                !w.isPartial &&
                                  w.unassignedDays === 0 &&
                                  done !== w.expectedMinutes &&
                                  "text-amber-600 dark:text-amber-400",
                              )}
                              title={w.isPartial ? "Partial week" : undefined}
                            >
                              {formatHoursMinutes(done)} /{" "}
                              {formatHoursMinutes(w.expectedMinutes)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/** Violations grouped by rule: rules with errors first, then by size. */
function groupByRule(violations: View["violations"]) {
  const groups = new Map<
    ViolationCode,
    {
      code: ViolationCode;
      errors: number;
      warnings: number;
      items: View["violations"];
    }
  >();
  for (const v of violations) {
    const group = groups.get(v.code) ?? {
      code: v.code,
      errors: 0,
      warnings: 0,
      items: [],
    };
    if (v.severity === "error") group.errors++;
    else group.warnings++;
    group.items.push(v);
    groups.set(v.code, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.errors > 0) - Number(a.errors > 0) ||
      b.items.length - a.items.length,
  );
}

function Num({ value, signed }: { value: number; signed?: boolean }) {
  return (
    <TableCell
      className={cn(
        "text-right font-mono whitespace-nowrap",
        signed && value < 0 && "text-destructive",
      )}
    >
      {formatHoursMinutes(value, signed)}
    </TableCell>
  );
}
