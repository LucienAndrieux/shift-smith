"use client";

import { useMemo } from "react";
import {
  indexView,
  type View,
} from "@/app/(app)/schedule/[year]/[month]/types";
import { ValidationPanel } from "@/app/(app)/schedule/[year]/[month]/validation-panel";
import { VersionHeader } from "@/app/(app)/schedule/[year]/[month]/version-header";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ValidationWorkspace({
  view,
  canEdit,
}: {
  view: View;
  /** The displayed version is editable by this user: shows the Fix buttons. */
  canEdit: boolean;
}) {
  const index = useMemo(() => indexView(view), [view]);
  return (
    <div className="flex flex-col gap-4">
      <VersionHeader view={view} basePath="/validation" />
      {view.schedule ? (
        <ValidationPanel sources={[{ view, index, canEdit }]} />
      ) : (
        <Alert>
          <AlertDescription>
            No schedule to validate for this month.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
