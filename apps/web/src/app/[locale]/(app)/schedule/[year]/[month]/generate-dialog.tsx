"use client";

import { CalendarClock, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { formatDayMonth, formatMonth } from "@/lib/domain/calendar";
import {
  getScheduleGeneration,
  startScheduleGeneration,
  startScheduleReplan,
} from "../../generate-actions";

/** Search times in seconds (labels in `t.generate.timeLimits`). */
const TIME_LIMITS = ["30", "60", "120"] as const;

type Phase =
  | { kind: "idle" }
  | { kind: "running"; runId: string; startedAt: number }
  | { kind: "error"; message: string };

/**
 * Generates a full-month draft with the OR-Tools solver or, with `replan`,
 * reworks a version of the current month from tomorrow on. The result is a new
 * draft version, checked by the validator like any other.
 */
export function GenerateDialog({
  year,
  month,
  replan,
}: {
  year: number;
  month: number;
  /** Version to replan and its first replanned day (tomorrow). */
  replan?: { scheduleId: string; from: string };
}) {
  const t = useT();
  const x = t.generate;
  const locale = useLocale();
  const text = replan
    ? {
        trigger: x.replan,
        title: x.replanTitle(formatDayMonth(replan.from, locale)),
        description: x.replanText,
        kept: x.replanKept,
        submit: x.replanDraft,
        working: x.replanning,
      }
    : {
        trigger: x.generate,
        title: x.title(formatMonth(year, month, locale)),
        description: x.text,
        kept: x.kept,
        submit: x.generateDraft,
        working: x.generating,
      };
  const replanning = replan !== undefined;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [timeLimit, setTimeLimit] = useState("60");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);

  // Poll the run while the solver works.
  useEffect(() => {
    if (phase.kind !== "running") return;
    const tick = setInterval(
      () => setElapsed(Math.round((Date.now() - phase.startedAt) / 1000)),
      1000,
    );
    const poll = setInterval(async () => {
      const result = await getScheduleGeneration({ runId: phase.runId });
      if (!result.ok) {
        setPhase({ kind: "error", message: result.error });
        return;
      }
      const run = result.data;
      if (run.status === "succeeded" && run.version) {
        setPhase({ kind: "idle" });
        setOpen(false);
        toast.success(
          (replanning ? x.replanned : x.generated)(
            run.version,
            run.seconds ? Math.round(run.seconds) : null,
            run.quality === "optimal",
          ),
        );
        router.push(`/schedule/${year}/${month}?version=${run.version}`);
        router.refresh();
      } else if (run.status === "infeasible" || run.status === "failed") {
        setPhase({
          kind: "error",
          message: run.error ?? x.failed,
        });
      }
    }, 2000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [phase, router, year, month, x, replanning]);

  async function start() {
    setElapsed(0);
    const timeLimitSeconds = Number(timeLimit);
    const result = replan
      ? await startScheduleReplan({
          scheduleId: replan.scheduleId,
          timeLimitSeconds,
        })
      : await startScheduleGeneration({ year, month, timeLimitSeconds });
    if (result.ok) {
      setPhase({
        kind: "running",
        runId: result.data.runId,
        startedAt: Date.now(),
      });
    } else {
      setPhase({ kind: "error", message: result.error });
    }
  }

  const running = phase.kind === "running";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return; // keep the dialog while the solver works
        setOpen(next);
        if (next) setPhase({ kind: "idle" });
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={replan ? "outline" : "default"}>
          {replan ? <CalendarClock /> : <Sparkles />} {text.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="time-limit">{x.searchTime}</Label>
          <Select
            value={timeLimit}
            onValueChange={setTimeLimit}
            disabled={running}
          >
            <SelectTrigger id="time-limit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_LIMITS.map((value) => (
                <SelectItem key={value} value={value}>
                  {x.timeLimits[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{text.kept}</p>
        </div>

        {running && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {x.solving(elapsed, Number(timeLimit))}
          </div>
        )}
        {phase.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{phase.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button onClick={start} disabled={running}>
            {running ? text.working : text.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
