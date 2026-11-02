"use client";

import { CircleHelp } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";

/** Visible marker for data imported as a best guess (to_confirm = true). */
export function ToConfirmBadge({ show = true }: { show?: boolean | null }) {
  const t = useT();
  if (!show) return null;
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      title={t.common.toConfirmTitle}
    >
      <CircleHelp /> {t.common.toConfirm}
    </Badge>
  );
}
