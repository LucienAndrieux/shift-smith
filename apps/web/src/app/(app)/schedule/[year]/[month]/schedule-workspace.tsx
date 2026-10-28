"use client";

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { readableTextColor } from "@/lib/colors";
import { MonthGrid } from "./month-grid";
import { ScheduleToolbar } from "./schedule-toolbar";
import { SectionPicker } from "./section-picker";
import { indexView, type SchedulePermissions, type View } from "./types";
import { WeekView } from "./week-view";

const ALL = "all";

export function ScheduleWorkspace({
  view,
  permissions,
}: {
  view: View;
  permissions: SchedulePermissions;
}) {
  const index = useMemo(() => indexView(view), [view]);
  const [section, setSection] = useState<string>(ALL);
  const [mode, setMode] = useState<"month" | "week">("month");
  const sectionId = section === ALL ? null : section;
  const canEdit =
    permissions.canEditCurrent &&
    view.schedule !== null &&
    view.schedule.status !== "archived" &&
    view.schedule.closedAt === null;

  return (
    <div className="flex flex-col gap-4">
      <ScheduleToolbar
        view={view}
        permissions={permissions}
        sectionCode={
          view.sections.find((s) => s.id === sectionId)?.code ?? null
        }
      />

      {!view.schedule ? (
        <Alert>
          <AlertDescription>
            {permissions.canPlan
              ? "No schedule exists for this month yet. Create a draft to start planning."
              : "No schedule has been published for this month yet."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <BookOpen /> Legend
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[40rem] max-w-[calc(100vw-2rem)] p-0"
                >
                  <Legend view={view} sectionId={sectionId} />
                </PopoverContent>
              </Popover>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mode}
                onValueChange={(v) => v && setMode(v as typeof mode)}
              >
                <ToggleGroupItem value="month">Month</ToggleGroupItem>
                <ToggleGroupItem value="week">Week</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          {mode === "month" ? (
            <MonthGrid
              view={view}
              index={index}
              sectionId={sectionId}
              canEdit={canEdit}
            />
          ) : (
            <WeekView view={view} index={index} sectionId={sectionId} />
          )}
        </>
      )}
    </div>
  );
}

interface LegendItem {
  key: string;
  code: string;
  color: string;
  text: string;
}

/**
 * Shift and day codes, shown in the "Legend" popover. One code per line. In a section tab, each shift shows its hours; in "All", shift
 * codes are listed once (colours are per code) with the sections that use them,
 * since hours differ by section.
 */
function Legend({ view, sectionId }: { view: View; sectionId: string | null }) {
  const active = view.shiftTypes.filter((s) => s.isActive);
  let shifts: LegendItem[];
  if (sectionId) {
    shifts = active
      .filter((s) => s.sectionId === sectionId)
      .map((s) => ({ key: s.id, code: s.code, color: s.color, text: s.hours }));
  } else {
    const sectionName = new Map(view.sections.map((s) => [s.id, s.name]));
    const byCode = new Map<string, LegendItem>();
    for (const s of active) {
      const name = sectionName.get(s.sectionId) ?? "";
      const item = byCode.get(s.code);
      if (item) item.text += `, ${name}`;
      else
        byCode.set(s.code, {
          key: s.code,
          code: s.code,
          color: s.color,
          text: name,
        });
    }
    shifts = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }
  const dayCodes = view.dayCodes.map((d) => ({
    key: d.code,
    code: d.code,
    color: d.color,
    text: d.label,
  }));

  return (
    <div className="grid gap-4 p-3 text-xs md:grid-cols-[1fr_1fr]">
      <LegendList
        title={sectionId ? "Shifts" : "Shifts (select a section for hours)"}
        items={shifts}
      />
      <LegendList title="Day codes" items={dayCodes} />
    </div>
  );
}

function LegendList({ title, items }: { title: string; items: LegendItem[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-muted-foreground">{title}</div>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className="inline-flex min-w-7 shrink-0 justify-center rounded px-1 font-bold"
              style={{
                backgroundColor: item.color,
                color: readableTextColor(item.color),
              }}
            >
              {item.code}
            </span>
            <span className="truncate" title={item.text}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
