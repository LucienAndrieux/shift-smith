import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ToConfirmBadge } from "@/components/to-confirm-badge";
import {
  Card,
  CardAction,
  CardContent,
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
import { db } from "@/db";
import { staffingOverrides, staffingRequirements } from "@/db/schema";
import {
  formatDayMonth,
  type Weekday,
  weekdayShort,
} from "@/lib/domain/calendar";
import { getLocale, getT } from "@/lib/i18n/server";
import { getSections, getShiftTypes } from "@/server/queries/reference";
import { requireUser } from "@/server/session";
import {
  DeleteOverrideButton,
  DeleteRequirementButton,
  OverrideDialog,
  RequirementDialog,
} from "./staffing-dialogs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.staffing };
}

export default async function StaffingPage() {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const st = t.staffing;
  const canManage = user.role === "manager";
  const [sections, shiftTypes, requirements, overrides] = await Promise.all([
    getSections(),
    getShiftTypes(),
    db.select().from(staffingRequirements),
    db.select().from(staffingOverrides).orderBy(asc(staffingOverrides.date)),
  ]);
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const shiftById = new Map(shiftTypes.map((s) => [s.id, s]));
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }));
  const shiftOptions = shiftTypes.map((s) => ({
    value: s.id,
    label: s.label,
    sectionId: s.sectionId,
  }));
  const shiftLabel = (id: string | null) =>
    id ? (shiftById.get(id)?.code ?? "?") : st.any;
  const sortedRequirements = [...requirements].sort(
    (a, b) =>
      (sectionById.get(a.sectionId)?.sortOrder ?? 0) -
        (sectionById.get(b.sectionId)?.sortOrder ?? 0) ||
      shiftLabel(a.shiftTypeId).localeCompare(shiftLabel(b.shiftTypeId)),
  );

  return (
    <>
      <PageHeader title={t.nav.staffing} description={st.pageText} />
      <Card>
        <CardHeader>
          <CardTitle>{st.requirements}</CardTitle>
          {canManage && (
            <CardAction>
              <RequirementDialog
                sections={sectionOptions}
                shifts={shiftOptions}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{st.section}</TableHead>
                <TableHead>{st.shift}</TableHead>
                <TableHead>{st.days}</TableHead>
                <TableHead>{st.min}</TableHead>
                <TableHead>{st.max}</TableHead>
                <TableHead>{st.validity}</TableHead>
                <TableHead>{st.note}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequirements.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{sectionById.get(r.sectionId)?.name}</TableCell>
                  <TableCell>{shiftLabel(r.shiftTypeId)}</TableCell>
                  <TableCell>
                    {r.weekday
                      ? weekdayShort(r.weekday as Weekday, locale)
                      : st.everyDay}
                  </TableCell>
                  <TableCell className="font-medium">{r.minStaff}</TableCell>
                  <TableCell>{r.maxStaff ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.validFrom || r.validTo
                      ? `${r.validFrom ?? "…"} → ${r.validTo ?? "…"}`
                      : st.always}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="flex flex-wrap items-center gap-2">
                      {r.note}
                      <ToConfirmBadge show={r.toConfirm} />
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <span className="flex justify-end">
                        <RequirementDialog
                          sections={sectionOptions}
                          shifts={shiftOptions}
                          initial={r}
                        />
                        <DeleteRequirementButton id={r.id} />
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{st.overrides}</CardTitle>
          {canManage && (
            <CardAction>
              <OverrideDialog sections={sectionOptions} shifts={shiftOptions} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">{st.noOverrides}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{st.date}</TableHead>
                  <TableHead>{st.section}</TableHead>
                  <TableHead>{st.shift}</TableHead>
                  <TableHead>{st.min}</TableHead>
                  <TableHead>{st.max}</TableHead>
                  <TableHead>{st.reason}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      {formatDayMonth(o.date, locale)} {o.date.slice(0, 4)}
                    </TableCell>
                    <TableCell>{sectionById.get(o.sectionId)?.name}</TableCell>
                    <TableCell>{shiftLabel(o.shiftTypeId)}</TableCell>
                    <TableCell className="font-medium">{o.minStaff}</TableCell>
                    <TableCell>{o.maxStaff ?? "—"}</TableCell>
                    <TableCell>{o.reason}</TableCell>
                    {canManage && (
                      <TableCell>
                        <span className="flex justify-end">
                          <OverrideDialog
                            sections={sectionOptions}
                            shifts={shiftOptions}
                            initial={o}
                          />
                          <DeleteOverrideButton id={o.id} />
                        </span>
                      </TableCell>
                    )}
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
