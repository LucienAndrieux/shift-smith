"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  const t = useT();
  const s = t.schedule;
  const index = useMemo(() => indexView(view), [view]);
  // An employee guest starts on their own section.
  const [section, setSection] = useState<string>(
    () =>
      view.employees.find((e) => e.id === permissions.ownEmployeeId)
        ?.sectionId ?? ALL,
  );
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
            {permissions.canPlan ? s.noneYetManager : s.noneYet}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div
            data-tour="schedule-views"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <SectionPicker
              value={sectionId}
              onChange={(id) => setSection(id ?? ALL)}
              options={[
                {
                  id: null,
                  code: ALL,
                  name: s.all,
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
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mode}
                onValueChange={(v) => v && setMode(v as typeof mode)}
              >
                <ToggleGroupItem value="month">{s.month}</ToggleGroupItem>
                <ToggleGroupItem value="week">{s.week}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          {mode === "month" ? (
            <MonthGrid
              view={view}
              index={index}
              sectionId={sectionId}
              canEdit={canEdit}
              canPlan={permissions.canPlan}
              ownEmployeeId={permissions.ownEmployeeId}
            />
          ) : (
            <WeekView view={view} index={index} sectionId={sectionId} />
          )}
        </>
      )}
    </div>
  );
}
