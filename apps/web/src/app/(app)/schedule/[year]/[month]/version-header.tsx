"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
 * Header of the pages built on one schedule version (Validation, Hours): the
 * month, the version picker and a link back to the schedule.
 */
export function VersionHeader({
  view,
  title,
  basePath,
}: {
  view: View;
  title: string;
  /** e.g. "/validation": the version picker navigates within this page. */
  basePath: string;
}) {
  const router = useRouter();
  const { year, month, schedule } = view;
  const versionQuery = schedule ? `?version=${schedule.version}` : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
        {title} · {formatMonth(year, month)}
      </h1>
      {schedule && view.versions.length > 1 && (
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
      {schedule && <Badge variant="secondary">{schedule.status}</Badge>}
      <div className="flex-1" />
      <Button variant="outline" size="sm" asChild>
        <Link href={`/schedule/${year}/${month}${versionQuery}`}>
          <CalendarDays /> Open the schedule
        </Link>
      </Button>
    </div>
  );
}
