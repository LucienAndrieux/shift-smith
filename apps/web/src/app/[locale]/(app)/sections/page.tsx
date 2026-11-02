import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHoursMinutes, formatTimeOfDay } from "@/lib/domain/time";
import { getT } from "@/lib/i18n/server";
import { getSections, getShiftTypes } from "@/server/queries/reference";
import { requireUser } from "@/server/session";
import { SectionDialog } from "./section-dialog";
import { DeleteShiftTypeButton, ShiftTypeDialog } from "./shift-type-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.sections };
}

export default async function SectionsPage() {
  const user = await requireUser();
  const t = await getT();
  const se = t.sections;
  const canManage = user.role === "manager";
  const [sections, shiftTypes] = await Promise.all([
    getSections(),
    getShiftTypes(),
  ]);

  return (
    <>
      <PageHeader title={t.nav.sections} description={se.pageText} />
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => {
          const shifts = shiftTypes.filter((s) => s.sectionId === section.id);
          return (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.name}</CardTitle>
                {section.coverageNote && (
                  <CardDescription>{section.coverageNote}</CardDescription>
                )}
                {canManage && (
                  <CardAction className="flex gap-1">
                    <SectionDialog section={section} />
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{se.code}</TableHead>
                        <TableHead>{se.periods}</TableHead>
                        <TableHead className="text-right">
                          {se.paidColumn}
                        </TableHead>
                        {canManage && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((s) => (
                        <TableRow
                          key={s.id}
                          className={s.isActive ? undefined : "opacity-50"}
                        >
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-flex size-6 items-center justify-center rounded text-xs font-bold text-white"
                                style={{ backgroundColor: s.color }}
                              >
                                {s.code}
                              </span>
                              {!s.isActive && (
                                <Badge variant="secondary">{se.inactive}</Badge>
                              )}
                              <ToConfirmBadge show={s.toConfirm} />
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="font-mono text-xs">
                              {s.periods
                                .map(
                                  (p) =>
                                    `${formatTimeOfDay(p.startMinute)}–${formatTimeOfDay(p.endMinute)}${
                                      p.unpaidBreakMinutes
                                        ? ` (−${p.unpaidBreakMinutes}′)`
                                        : ""
                                    }`,
                                )
                                .join("  ·  ")}
                            </div>
                            {s.notes && (
                              <div className="text-xs text-muted-foreground">
                                {s.notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatHoursMinutes(s.paidMinutes)}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <span className="flex justify-end">
                                <ShiftTypeDialog
                                  sectionId={section.id}
                                  shift={s}
                                />
                                <DeleteShiftTypeButton
                                  id={s.id}
                                  code={s.code}
                                />
                              </span>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {canManage && (
                  <div>
                    <ShiftTypeDialog sectionId={section.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
