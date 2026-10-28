"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionPicker } from "@/app/(app)/schedule/[year]/[month]/section-picker";
import {
  indexView,
  type View,
} from "@/app/(app)/schedule/[year]/[month]/types";
import { ValidationPanel } from "@/app/(app)/schedule/[year]/[month]/validation-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonth } from "@/lib/domain/calendar";

const ALL = "all";

/** Month navigation, version and section pickers around the validation panel. */
export function ValidationWorkspace({
  view,
  canEdit,
}: {
  view: View;
  /** The displayed version is editable by this user: shows the Fix buttons. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const index = useMemo(() => indexView(view), [view]);
  const [section, setSection] = useState<string>(ALL);
  const sectionId = section === ALL ? null : section;
  const { year, month, schedule } = view;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const versionQuery = schedule ? `?version=${schedule.version}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            asChild
            aria-label="Previous month"
          >
            <Link href={`/validation/${prev.y}/${prev.m}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <h1 className="flex-1 text-center text-lg font-semibold tracking-tight sm:min-w-44 sm:flex-none sm:text-xl">
            {formatMonth(year, month)}
          </h1>
          <Button variant="outline" size="icon" asChild aria-label="Next month">
            <Link href={`/validation/${next.y}/${next.m}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        {schedule && view.versions.length > 1 && (
          <Select
            value={String(schedule.version)}
            onValueChange={(v) =>
              router.push(`/validation/${year}/${month}?version=${v}`)
            }
          >
            <SelectTrigger className="w-44 sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.versions.map((v) => (
                <SelectItem key={v.id} value={String(v.version)}>
                  v{v.version} · {v.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {schedule && <Badge variant="secondary">{schedule.status}</Badge>}
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/schedule/${year}/${month}${versionQuery}`}>
            <CalendarDays /> Open the schedule
          </Link>
        </Button>
      </div>

      {!schedule ? (
        <Alert>
          <AlertDescription>
            No schedule to validate for this month.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SectionPicker
            value={sectionId}
            onChange={(id) => setSection(id ?? ALL)}
            options={[
              {
                id: null,
                code: ALL,
                name: "All",
                count: view.employees.length,
              },
              ...view.sections.map((s) => ({
                id: s.id,
                code: s.code,
                name: s.name,
                count: view.employees.filter((e) => e.sectionId === s.id)
                  .length,
              })),
            ]}
          />
          <ValidationPanel
            view={view}
            index={index}
            sectionId={sectionId}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}
