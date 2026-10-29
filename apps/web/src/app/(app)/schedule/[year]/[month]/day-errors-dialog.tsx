"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { violationIdentity } from "@/lib/domain/validator";
import { FixDialog } from "./fix-dialog";
import type { View, ViewIndex } from "./types";

/**
 * Errors of one day, opened from a day outlined in red in the grid header: the
 * same lines as the Validation page, with a Fix button on each for planners.
 */
export function DayErrorsDialog({
  open,
  onOpenChange,
  title,
  violations,
  view,
  index,
  canPlan,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day, e.g. "Saturday 3 October". */
  title: string;
  violations: View["violations"];
  view: View;
  index: ViewIndex;
  canPlan: boolean;
  /** The displayed version is editable by this user. */
  canEdit: boolean;
}) {
  const schedule = view.schedule;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Errors · {title}</DialogTitle>
          <DialogDescription>
            {violations.length === 0
              ? "No error left on this day."
              : `${violations.length} error(s) on this day.`}
          </DialogDescription>
        </DialogHeader>
        {violations.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Description</TableHead>
                {canPlan && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((v) => (
                <TableRow key={violationIdentity(v)}>
                  <TableCell className="whitespace-nowrap">
                    {v.employeeId
                      ? index.employeeById.get(v.employeeId)?.name
                      : (index.sectionById.get(v.sectionId ?? "")?.name ?? "—")}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {v.message}
                  </TableCell>
                  {canPlan && (
                    <TableCell className="text-right">
                      {schedule && (
                        <FixDialog
                          scheduleId={schedule.id}
                          scheduleStatus={schedule.status}
                          editable={canEdit}
                          canApplyToPublished={
                            schedule.status === "published" &&
                            schedule.closedAt === null
                          }
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
        )}
      </DialogContent>
    </Dialog>
  );
}
