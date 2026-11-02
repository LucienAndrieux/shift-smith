"use client";

import { useMemo } from "react";
import {
  indexView,
  type View,
} from "@/app/[locale]/(app)/schedule/[year]/[month]/types";
import { ValidationPanel } from "@/app/[locale]/(app)/schedule/[year]/[month]/validation-panel";
import { VersionHeader } from "@/app/[locale]/(app)/schedule/[year]/[month]/version-header";
import { useT } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ValidationWorkspace({
  view,
  canEdit,
  canPlan,
}: {
  view: View;
  /** Manager: shows the Fix buttons. */
  canPlan: boolean;
  /** The displayed version is editable by this user: shows the Fix buttons. */
  canEdit: boolean;
}) {
  const t = useT();
  const index = useMemo(() => indexView(view), [view]);
  return (
    <div className="flex flex-col gap-4">
      <VersionHeader view={view} basePath="/validation" />
      {view.schedule ? (
        <ValidationPanel
          sources={[{ view, index, canEdit }]}
          canPlan={canPlan}
        />
      ) : (
        <Alert>
          <AlertDescription>{t.validationPage.noSchedule}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
