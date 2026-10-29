import { desc, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { schedules } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatMonth } from "@/lib/domain/calendar";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Hour bank" };

export default async function HourBankPage() {
  await requireUser();
  const published = await db
    .select()
    .from(schedules)
    .where(eq(schedules.status, "published"))
    .orderBy(desc(schedules.year), desc(schedules.month));

  return (
    <>
      <PageHeader
        title="Hour bank"
        description="Each month is closed from its published schedule. Balances are the sum of opening balances, monthly closings and manual adjustments."
      />
      <Card>
        <CardContent>
          {published.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published schedule yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Published version</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {published.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/hour-bank/${s.year}/${s.month}`}
                        className="font-medium hover:underline"
                      >
                        {formatMonth(s.year, s.month)}
                      </Link>
                    </TableCell>
                    <TableCell>v{s.version}</TableCell>
                    <TableCell>
                      {s.closedAt ? (
                        <Badge>
                          <Lock /> Closed {formatDateTime(s.closedAt)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
