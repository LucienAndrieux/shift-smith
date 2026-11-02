"use client";

import { useMemo } from "react";
import { HoursTable } from "@/app/[locale]/(app)/schedule/[year]/[month]/hours-table";
import {
  indexView,
  type View,
} from "@/app/[locale]/(app)/schedule/[year]/[month]/types";
import { VersionHeader } from "@/app/[locale]/(app)/schedule/[year]/[month]/version-header";
import { useT } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function HoursWorkspace({ view }: { view: View }) {
  const t = useT();
  const index = useMemo(() => indexView(view), [view]);
  return (
    <div className="flex flex-col gap-4">
      <VersionHeader view={view} title={t.nav.hours} basePath="/hours" />
      {view.schedule ? (
        <HoursTable view={view} index={index} />
      ) : (
        <Alert>
          <AlertDescription>{t.schedule.noSchedule}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
