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
import { getLocale, getT } from "@/lib/i18n/server";
import { requireUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.hourBank };
}

export default async function HourBankPage() {
  await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const hb = t.hourBank;
  const published = await db
    .select()
    .from(schedules)
    .where(eq(schedules.status, "published"))
    .orderBy(desc(schedules.year), desc(schedules.month));

  return (
    <>
      <PageHeader title={t.nav.hourBank} description={hb.pageText} />
      <Card>
        <CardContent>
          {published.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hb.noPublished}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hb.month}</TableHead>
                  <TableHead>{hb.publishedVersion}</TableHead>
                  <TableHead>{hb.status}</TableHead>
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
                        {formatMonth(s.year, s.month, locale)}
                      </Link>
                    </TableCell>
                    <TableCell>v{s.version}</TableCell>
                    <TableCell>
                      {s.closedAt ? (
                        <Badge>
                          <Lock />{" "}
                          {hb.closedOn(formatDateTime(s.closedAt, locale))}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{hb.open}</Badge>
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
