"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isoWeeksOfMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import type { View, ViewIndex } from "./types";

/** Monthly and weekly hours of every employee in a version, grouped by section. */
export function HoursTable({ view, index }: { view: View; index: ViewIndex }) {
  const weeks = isoWeeksOfMonth(view.year, view.month);
  const totals = new Map(view.totals.map((t) => [t.employeeId, t]));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Expected = daily contract × (shift days + due days). Credited = daily
        contract × days whose code credits time. TL is due but credits nothing.
        Week columns show (worked + credited) / expected.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Section</TableHead>
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
            {view.employees.map((e) => {
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
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {index.sectionById.get(e.sectionId)?.name}
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
    </div>
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
