import { asc } from "drizzle-orm";
import type { Metadata } from "next";
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
import { holidays } from "@/db/schema";
import { type Weekday, weekday, weekdayShort } from "@/lib/domain/calendar";
import { getLocale, getT } from "@/lib/i18n/server";
import { requireUser } from "@/server/session";
import { DeleteHolidayButton, HolidayDialog } from "./holiday-dialogs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.holidays };
}

export default async function HolidaysPage() {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const h = t.holidays;
  const canManage = user.role === "manager";
  const rows = await db.select().from(holidays).orderBy(asc(holidays.date));

  return (
    <>
      <PageHeader
        title={t.nav.holidays}
        description={h.pageText}
        actions={canManage && <HolidayDialog />}
      />
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{h.date}</TableHead>
                <TableHead>{h.day}</TableHead>
                <TableHead>{h.name}</TableHead>
                <TableHead>{h.type}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.date}</TableCell>
                  <TableCell>
                    {weekdayShort(weekday(row.date) as Weekday, locale)}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {t.enums.holidayType[row.type]}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <span className="flex justify-end">
                        <HolidayDialog initial={row} />
                        <DeleteHolidayButton id={row.id} />
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
