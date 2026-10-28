"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonth } from "@/lib/domain/calendar";
import type { View } from "./types";

/**
 * Header of the pages built on one schedule version (Validation, Hours): an
 * optional title with the month and status, and the version picker.
 */
export function VersionHeader({
  view,
  title,
  basePath,
}: {
  view: View;
  /** Omitted when the page's tables already show the dates (Validation). */
  title?: string;
  /** e.g. "/validation": the version picker navigates within this page. */
  basePath: string;
}) {
  const router = useRouter();
  const { year, month, schedule } = view;
  const hasPicker = schedule !== null && view.versions.length > 1;
  if (!title && !hasPicker) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {title && (
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          {title} · {formatMonth(year, month)}
        </h1>
      )}
      {schedule && hasPicker && (
        <Select
          value={String(schedule.version)}
          onValueChange={(v) =>
            router.push(`${basePath}/${year}/${month}?version=${v}`)
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
      {title && schedule && (
        <Badge variant="secondary">{schedule.status}</Badge>
      )}
    </div>
  );
}
