"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { formatMonth } from "@/lib/domain/calendar";
import {
  getScheduleGeneration,
  startScheduleGeneration,
} from "../../generate-actions";

const TIME_LIMITS = [
  { value: "30", label: "30 seconds (quick)" },
  { value: "60", label: "1 minute" },
  { value: "120", label: "2 minutes (best quality)" },
];

type Phase =
  | { kind: "idle" }
  | { kind: "running"; runId: string; startedAt: number }
  | { kind: "error"; message: string };

/**
 * Generates a full-month draft with the OR-Tools solver. The result is a new
 * draft version, checked by the validator like any other.
 */
export function GenerateDialog({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
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
          `Draft v${run.version} generated${run.seconds ? ` in ${Math.round(run.seconds)} s` : ""}${
            run.quality === "optimal" ? " (optimal)" : ""
          }`,
        );
        router.push(`/schedule/${year}/${month}?version=${run.version}`);
        router.refresh();
      } else if (run.status === "infeasible" || run.status === "failed") {
        setPhase({
          kind: "error",
          message: run.error ?? "The generation failed.",
        });
      }
    }, 2000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [phase, router, year, month]);

  async function start() {
    setElapsed(0);
    const result = await startScheduleGeneration({
      year,
      month,
      timeLimitSeconds: Number(timeLimit),
    });
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
        <Button size="sm">
          <Sparkles /> Generate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate {formatMonth(year, month)}</DialogTitle>
          <DialogDescription>
            The solver builds a complete schedule that meets every hard rule
            (rest between shifts, consecutive days, two rest days a week,
            approved leave, eligibility) and satisfies staffing, weekends off,
            couples, time off in lieu and hour balances as far as possible. The
            result is a new draft: review it before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="time-limit">Search time</Label>
          <Select
            value={timeLimit}
            onValueChange={setTimeLimit}
            disabled={running}
          >
            <SelectTrigger id="time-limit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_LIMITS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Locked cells of the latest version, approved absences and birthdays
            are kept.
          </p>
        </div>

        {running && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Solving… {elapsed} s / {timeLimit} s
          </div>
        )}
        {phase.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{phase.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button onClick={start} disabled={running}>
            {running ? "Generating…" : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
