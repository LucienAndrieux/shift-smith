"use client";

import { useMemo } from "react";
import { HoursTable } from "@/app/(app)/schedule/[year]/[month]/hours-table";
import {
  indexView,
  type View,
} from "@/app/(app)/schedule/[year]/[month]/types";
import { VersionHeader } from "@/app/(app)/schedule/[year]/[month]/version-header";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function HoursWorkspace({ view }: { view: View }) {
  const index = useMemo(() => indexView(view), [view]);
  return (
    <div className="flex flex-col gap-4">
      <VersionHeader view={view} title="Hours" basePath="/hours" />
      {view.schedule ? (
        <HoursTable view={view} index={index} />
      ) : (
        <Alert>
          <AlertDescription>No schedule for this month.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
