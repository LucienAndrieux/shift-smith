"use client";

import { useMemo } from "react";
import { indexView } from "@/app/[locale]/(app)/schedule/[year]/[month]/types";
import { ValidationPanel } from "@/app/[locale]/(app)/schedule/[year]/[month]/validation-panel";
import { useLocale, useT } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMonth } from "@/lib/domain/calendar";
import type { ValidationTarget } from "@/server/queries/validation";

export function UpcomingValidation({
  targets,
  canPlan,
}: {
  targets: ValidationTarget[];
  /** Manager: shows the Fix buttons. */
  canPlan: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const sources = useMemo(
    () =>
      targets.map((target) => ({
        view: target.view,
        index: indexView(target.view),
        canEdit: target.canEdit,
      })),
    [targets],
  );
  if (sources.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t.validationPage.noUpcoming}</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {sources
          .map(
            ({ view }) =>
              `${formatMonth(view.year, view.month, locale)} (v${view.schedule?.version} · ${view.schedule ? t.enums.scheduleStatus[view.schedule.status] : ""})`,
          )
          .join(" · ")}
      </p>
      <ValidationPanel sources={sources} canPlan={canPlan} />
    </div>
  );
}
