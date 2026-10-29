"use client";

import {
  ArrowRight,
  CopyPlus,
  Loader2,
  Pencil,
  Send,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import {
  applyScheduleFix,
  type FixSuggestionView,
  suggestScheduleFixes,
} from "../../fix-actions";

/** Where a fix can go, shared by the Fix button and the grid's error cells. */
interface FixTarget {
  scheduleId: string;
  scheduleStatus: "draft" | "published" | "archived";
  /** The version itself is editable by the user. */
  editable: boolean;
  /** The fix may go straight into this published version. */
  canApplyToPublished: boolean;
}

/** An error or a warning to fix. */
export interface FixIssue {
  /** violationIdentity() of the error or warning. */
  violation: string;
  message: string;
}

/**
 * "Fix" button next to an error or a warning: computes up to five local edits that
 * remove it without creating an error, and applies the chosen one. On an editable
 * draft the fix goes straight in; otherwise the user chooses between a new draft
 * holding the fix and (admins only) the published version itself.
 */
export function FixDialog({
  violation,
  message,
  ...target
}: FixTarget & FixIssue) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" className="shrink-0">
          <Wand2 /> Fix
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fix suggestions</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <FixSuggestions
          {...target}
          violation={violation}
          onApplied={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fix suggestions for a cell outlined in red in the grid: one or several errors of
 * that employee on that day, the first one selected.
 */
export function CellFixDialog({
  open,
  onOpenChange,
  title,
  issues,
  onEditByHand,
  ...target
}: FixTarget & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Employee and date. */
  title: string;
  issues: FixIssue[];
  /** Shown when the cell can be edited directly. */
  onEditByHand?: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const issue = issues[Math.min(selected, issues.length - 1)];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(0);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fix suggestions · {title}</DialogTitle>
          <DialogDescription>
            {issues.length === 1
              ? issue?.message
              : `${issues.length} errors on this day: choose the one to fix.`}
          </DialogDescription>
        </DialogHeader>
        {issues.length > 1 && (
          <div className="flex flex-col gap-1.5">
            {issues.map((x, i) => (
              <button
                key={x.violation}
                type="button"
                onClick={() => setSelected(i)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                  x === issue && "border-primary bg-muted/50",
                )}
              >
                {x.message}
              </button>
            ))}
          </div>
        )}
        {issue && (
          <FixSuggestions
            key={issue.violation}
            {...target}
            violation={issue.violation}
            onApplied={() => onOpenChange(false)}
          />
        )}
        {onEditByHand && (
          <DialogFooter>
            <Button variant="outline" onClick={onEditByHand}>
              <Pencil /> Edit the cell by hand
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Loads the suggestions for one violation when mounted, and applies one. */
function FixSuggestions({
  scheduleId,
  scheduleStatus,
  editable,
  canApplyToPublished,
  violation,
  onApplied,
}: FixTarget & { violation: string; onApplied: () => void }) {
  const router = useRouter();
  /** Suggestion waiting for the "where to apply" choice. */
  const [choosing, setChoosing] = useState<number | null>(null);
  const appliesDirectly = editable && scheduleStatus === "draft";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FixSuggestionView[] | null>(
    null,
  );
  const { pending, run } = useAction();

  useEffect(() => {
    let cancelled = false;
    suggestScheduleFixes({ scheduleId, violation })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setSuggestions(result.data);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("Could not compute suggestions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scheduleId, violation]);

  async function apply(
    suggestion: FixSuggestionView,
    target: "current" | "new-draft",
  ) {
    const result = await run(
      () =>
        applyScheduleFix({
          scheduleId,
          target,
          changes: suggestion.changes.map(
            ({ employeeId, date, before, after }) => ({
              employeeId,
              date,
              before,
              after,
            }),
          ),
        }),
      {
        success:
          target === "new-draft" ? "Draft created with the fix" : "Fix applied",
      },
    );
    if (!result.ok) return;
    onApplied();
    // A page showing an explicit version follows the new draft.
    const url = new URL(window.location.href);
    if (result.data.createdDraft && url.searchParams.has("version")) {
      url.searchParams.set("version", String(result.data.version));
      router.push(`${url.pathname}?${url.searchParams}`);
    }
  }

  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Looking for fixes…
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {suggestions?.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          No local fix found: every change of one or two cells around this
          problem would create an error. Adjust the grid by hand, or check the
          rule and staffing settings.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {suggestions?.map((s, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: suggestions are positional
            key={i}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Option {i + 1}</span>
              {s.fixedErrors > 1 && (
                <Badge variant="secondary">
                  Also fixes {s.fixedErrors - 1} other error(s)
                </Badge>
              )}
              {s.newWarnings > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/60 text-amber-700 dark:text-amber-400"
                >
                  +{s.newWarnings} warning(s)
                </Badge>
              ) : (
                <Badge variant="outline">No new warning</Badge>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  appliesDirectly ? apply(s, "current") : setChoosing(i)
                }
              >
                Apply
              </Button>
            </div>
            {choosing === i && (
              <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <p>
                  This version is {scheduleStatus}. Where should the fix go?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => apply(s, "new-draft")}
                  >
                    <CopyPlus /> Create a draft with this fix
                  </Button>
                  {scheduleStatus === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !canApplyToPublished}
                      onClick={() => apply(s, "current")}
                    >
                      <Send /> Apply to the published schedule
                    </Button>
                  )}
                </div>
                {scheduleStatus === "published" && !canApplyToPublished && (
                  <p className="text-xs text-muted-foreground">
                    The hour bank of this month is closed: the published
                    schedule is read-only.
                  </p>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-1 text-sm">
              {s.changes.map((c) => (
                <li
                  key={`${c.employeeId}-${c.date}`}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span className="font-medium">{c.employeeName}</span>
                  <span className="text-muted-foreground">· {c.dateLabel}</span>
                  <Badge variant="outline" className="font-mono">
                    {c.beforeLabel}
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <Badge className="font-mono">{c.afterLabel}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
