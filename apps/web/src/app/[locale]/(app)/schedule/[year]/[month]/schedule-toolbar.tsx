"use client";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Lock,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { useLocale, useT } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { formatMonth } from "@/lib/domain/calendar";
import {
  createDraft,
  deleteDraft,
  duplicateSchedule,
  publishSchedule,
} from "../../actions";
import { GenerateDialog } from "./generate-dialog";
import type { SchedulePermissions, View } from "./types";

const STATUS_VARIANT = {
  draft: "outline",
  published: "default",
  archived: "secondary",
} as const;

export function ScheduleToolbar({
  view,
  permissions,
  sectionCode,
}: {
  view: View;
  permissions: SchedulePermissions;
  /** Section shown on screen (null = all), used by the PDF export. */
  sectionCode: string | null;
}) {
  const t = useT();
  const s = t.schedule;
  const locale = useLocale();
  const router = useRouter();
  const { pending, run } = useAction();
  const { year, month, schedule } = view;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const base = `/schedule/${year}/${month}`;
  const goToVersion = (version: number) =>
    router.push(`${base}?version=${version}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex w-full items-center gap-1 sm:w-auto">
        <Button
          variant="outline"
          size="icon"
          asChild
          aria-label={s.previousMonth}
        >
          <Link href={`/schedule/${prev.y}/${prev.m}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="flex-1 text-center font-display text-xl font-bold tracking-tight sm:min-w-48 sm:flex-none sm:text-2xl">
          {formatMonth(year, month, locale)}
        </h1>
        <Button variant="outline" size="icon" asChild aria-label={s.nextMonth}>
          <Link href={`/schedule/${next.y}/${next.m}`}>
            <ChevronRight />
          </Link>
        </Button>
      </div>

      {schedule && (
        <>
          {/* Read-only users only ever receive the published version. */}
          {permissions.canPlan && view.versions.length > 1 && (
            <Select
              value={String(schedule.version)}
              onValueChange={(v) => goToVersion(Number(v))}
            >
              <SelectTrigger className="w-44 sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {view.versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.version)}>
                    v{v.version} · {t.enums.scheduleStatus[v.status]}
                    {` · ${t.enums.scheduleSource[v.source]}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant={STATUS_VARIANT[schedule.status]}>
            {t.enums.scheduleStatus[schedule.status]}
          </Badge>
          {schedule.closedAt && (
            <Badge variant="secondary">
              <Lock /> {s.hourBankClosed}
            </Badge>
          )}
        </>
      )}

      <div className="flex-1" />

      {permissions.canPlan && (
        <div className="flex flex-wrap gap-2">
          {permissions.canGenerate && (
            <GenerateDialog year={year} month={month} />
          )}
          <NewDraftDialog
            year={year}
            month={month}
            onCreated={(version) => goToVersion(version)}
          />
          {schedule && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                const result = await run(
                  () => duplicateSchedule({ scheduleId: schedule.id }),
                  {
                    success: s.duplicated,
                  },
                );
                if (result.ok) goToVersion(result.data.version);
              }}
            >
              <Copy /> {s.duplicate}
              <span className="hidden sm:inline">{s.asDraft}</span>
            </Button>
          )}
          {permissions.canPublish &&
            schedule?.status !== "published" &&
            schedule &&
            schedule.status !== "archived" && (
              <ConfirmButton
                title={s.publishTitle(schedule.version)}
                description={s.publishText}
                confirmLabel={s.publish}
                successMessage={s.published}
                action={() => publishSchedule({ scheduleId: schedule.id })}
                trigger={
                  <Button size="sm">
                    <Send /> {s.publish}
                  </Button>
                }
              />
            )}
          {permissions.canPublish && schedule?.status === "archived" && (
            <ConfirmButton
              title={s.republishTitle(schedule.version)}
              confirmLabel={s.publish}
              successMessage={s.published}
              action={() => publishSchedule({ scheduleId: schedule.id })}
              trigger={
                <Button size="sm" variant="outline">
                  <Send /> {s.republish}
                </Button>
              }
            />
          )}
          {permissions.canEditCurrent && schedule?.status === "draft" && (
            <ConfirmButton
              title={s.deleteDraftTitle(schedule.version)}
              description={s.deleteDraftText}
              successMessage={s.draftDeleted}
              action={async () => {
                const result = await deleteDraft({ scheduleId: schedule.id });
                if (result.ok) router.push(base);
                return result;
              }}
              trigger={
                <Button size="sm" variant="ghost">
                  <Trash2 /> {s.deleteDraft}
                </Button>
              }
            />
          )}
        </div>
      )}

      {schedule && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`${base}/pdf?version=${schedule.version}${sectionCode ? `&section=${sectionCode}` : ""}`}
            target="_blank"
            rel="noopener"
          >
            <FileText /> PDF
          </a>
        </Button>
      )}
    </div>
  );
}

function NewDraftDialog({
  year,
  month,
  onCreated,
}: {
  year: number;
  month: number;
  onCreated: (version: number) => void;
}) {
  const t = useT();
  const s = t.schedule;
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState(true);
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FilePlus2 /> {s.newDraft}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {s.newDraftTitle(formatMonth(year, month, locale))}
          </DialogTitle>
          <DialogDescription>{s.newDraftText}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3">
          <Checkbox
            id="prefill"
            checked={prefill}
            onCheckedChange={(c) => setPrefill(c === true)}
          />
          <Label
            htmlFor="prefill"
            className="flex flex-col items-start gap-1 font-normal"
          >
            {s.prefill}
            <span className="text-xs text-muted-foreground">
              {s.prefillText}
            </span>
          </Label>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={async () => {
              const result = await run(
                () => createDraft({ year, month, prefill }),
                {
                  success: s.draftCreated,
                },
              );
              if (result.ok) {
                setOpen(false);
                onCreated(result.data.version);
              }
            }}
          >
            {s.createDraft}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
