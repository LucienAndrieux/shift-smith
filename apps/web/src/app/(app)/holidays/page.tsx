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
import { requireUser } from "@/server/session";
import { DeleteHolidayButton, HolidayDialog } from "./holiday-dialogs";

export const metadata: Metadata = { title: "Holidays" };

export default async function HolidaysPage() {
  const user = await requireUser();
  const canManage = user.role === "manager";
  const rows = await db.select().from(holidays).orderBy(asc(holidays.date));

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Public holidays are highlighted on the schedule; staff off on a holiday are coded PH."
        actions={canManage && <HolidayDialog />}
      />
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono">{h.date}</TableCell>
                  <TableCell>
                    {weekdayShort(weekday(h.date) as Weekday)}
                  </TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{h.type}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <span className="flex justify-end">
                        <HolidayDialog initial={h} />
                        <DeleteHolidayButton id={h.id} />
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
