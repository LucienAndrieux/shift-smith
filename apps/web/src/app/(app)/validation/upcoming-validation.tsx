"use client";

import { useMemo } from "react";
import { indexView } from "@/app/(app)/schedule/[year]/[month]/types";
import { ValidationPanel } from "@/app/(app)/schedule/[year]/[month]/validation-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMonth } from "@/lib/domain/calendar";
import type { ValidationTarget } from "@/server/queries/validation";

export function UpcomingValidation({
  targets,
}: {
  targets: ValidationTarget[];
}) {
  const sources = useMemo(
    () =>
      targets.map((t) => ({
        view: t.view,
        index: indexView(t.view),
        canEdit: t.canEdit,
      })),
    [targets],
  );
  if (sources.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No schedule for the current or upcoming months.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {sources
          .map(
            ({ view }) =>
              `${formatMonth(view.year, view.month)} (v${view.schedule?.version} · ${view.schedule?.status})`,
          )
          .join(" · ")}
      </p>
      <ValidationPanel sources={sources} />
    </div>
  );
}
