import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { formatMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import {
  getClosePreview,
  getPublishedSchedule,
} from "@/server/queries/hour-bank";
import { requireApprovedUser } from "@/server/session";
import { CloseMonthButton, ReopenMonthButton } from "./close-buttons";

export const metadata: Metadata = { title: "Hour bank" };

export default async function HourBankMonthPage({
  params,
}: PageProps<"/hour-bank/[year]/[month]">) {
  const user = await requireApprovedUser();
  const { year: y, month: m } = await params;
  const year = Number(y);
  const month = Number(m);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }
  const isAdmin = user.role === "admin";
  const schedule = await getPublishedSchedule(year, month);
  const label = formatMonth(year, month);

  if (!schedule) {
    return (
      <>
        <PageHeader title={`Hour bank — ${label}`} />
        <Alert>
          <AlertDescription>
            No published schedule for {label}. The hour bank is closed from the
            published version.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const preview = await getClosePreview(schedule);
  const excluded = preview.rows.filter((r) => !r.included);
  const closed = schedule.closedAt !== null;

  return (
    <>
      <PageHeader
        title={`Hour bank — ${label}`}
        description={
          <>
            Computed from the published schedule{" "}
            <Link
              href={`/schedule/${year}/${month}?version=${schedule.version}`}
              className="underline"
            >
              v{schedule.version}
            </Link>
            . Monthly delta = worked + credited − expected.
          </>
        }
        actions={
          isAdmin &&
          (closed ? (
            <ReopenMonthButton scheduleId={schedule.id} label={label} />
          ) : (
            <CloseMonthButton
              scheduleId={schedule.id}
              label={label}
              count={preview.rows.length - excluded.length}
            />
          ))
        }
      />
      {closed ? (
        <Alert>
          <Lock />
          <AlertDescription>
            Closed on {formatDateTime(schedule.closedAt)}. The balances below
            include the closing entries; the schedule is read-only until the
            month is reopened.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>
            Preview only: nothing is written until an admin closes the month.
            {excluded.length > 0 &&
              ` ${excluded.length} employee(s) with empty days are excluded: complete their rows first.`}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Worked</TableHead>
                <TableHead className="text-right">Credited</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">Balance before</TableHead>
                <TableHead className="text-right">New balance</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r) => (
                <TableRow
                  key={r.employeeId}
                  className={r.included ? undefined : "opacity-60"}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    <Link
                      href={`/employees/${r.employeeId}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.section}</TableCell>
                  <Minutes value={r.period.expectedMinutes} />
                  <Minutes value={r.period.workedMinutes} />
                  <Minutes value={r.period.creditedMinutes} />
                  <Minutes value={r.period.deltaMinutes} signed />
                  <Minutes value={r.previousBalance} signed />
                  <Minutes value={r.newBalance} signed strong />
                  <TableCell>
                    {!r.included && (
                      <Badge variant="outline">
                        {r.period.unassignedDays} empty day(s)
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hour-bank">All months</Link>
        </Button>
      </div>
    </>
  );
}

function Minutes({
  value,
  signed,
  strong,
}: {
  value: number;
  signed?: boolean;
  strong?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-right font-mono whitespace-nowrap tabular-nums",
        signed && value < 0 && "text-destructive",
        strong && "font-semibold",
      )}
    >
      {formatHoursMinutes(value, signed)}
    </TableCell>
  );
}
