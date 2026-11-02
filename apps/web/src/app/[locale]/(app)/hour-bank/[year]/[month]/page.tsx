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
import { getLocale, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import {
  getClosePreview,
  getPublishedSchedule,
} from "@/server/queries/hour-bank";
import { requireUser } from "@/server/session";
import { CloseMonthButton, ReopenMonthButton } from "./close-buttons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.hourBank };
}

export default async function HourBankMonthPage({
  params,
}: PageProps<"/[locale]/hour-bank/[year]/[month]">) {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const hb = t.hourBank;
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
  const canManage = user.role === "manager";
  const schedule = await getPublishedSchedule(year, month);
  const label = formatMonth(year, month, locale);

  if (!schedule) {
    return (
      <>
        <PageHeader title={hb.monthTitle(label)} />
        <Alert>
          <AlertDescription>{hb.noPublishedFor(label)}</AlertDescription>
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
        title={hb.monthTitle(label)}
        description={
          <>
            {hb.computedFrom}{" "}
            <Link
              href={`/schedule/${year}/${month}?version=${schedule.version}`}
              className="underline"
            >
              v{schedule.version}
            </Link>
            {hb.deltaFormula}
          </>
        }
        actions={
          canManage &&
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
            {hb.closedText(formatDateTime(schedule.closedAt, locale))}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>
            {hb.previewOnly}
            {excluded.length > 0 && ` ${hb.excluded(excluded.length)}`}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hb.employee}</TableHead>
                <TableHead>{hb.section}</TableHead>
                <TableHead className="text-right">{hb.expected}</TableHead>
                <TableHead className="text-right">{hb.worked}</TableHead>
                <TableHead className="text-right">{hb.credited}</TableHead>
                <TableHead className="text-right">{hb.delta}</TableHead>
                <TableHead className="text-right">{hb.balanceBefore}</TableHead>
                <TableHead className="text-right">{hb.newBalance}</TableHead>
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
                        {hb.emptyDays(r.period.unassignedDays)}
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
          <Link href="/hour-bank">{hb.allMonths}</Link>
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
