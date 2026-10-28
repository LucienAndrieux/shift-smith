"use client";

import { ArrowRight, CopyPlus, Loader2, Send, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import {
  applyScheduleFix,
  type FixSuggestionView,
  suggestScheduleFixes,
} from "../../fix-actions";

/**
 * "Fix" button next to an error or a warning: computes up to five local edits that
 * remove it without creating an error, and applies the chosen one. On an editable
 * draft the fix goes straight in; otherwise the user chooses between a new draft
 * holding the fix and (admins only) the published version itself.
 */
export function FixDialog({
  scheduleId,
  scheduleStatus,
  editable,
  violation,
  message,
}: {
  scheduleId: string;
  scheduleStatus: "draft" | "published" | "archived";
  /** The version itself is editable by the user. */
  editable: boolean;
  /** violationIdentity() of the error or warning. */
  violation: string;
  message: string;
}) {
  const router = useRouter();
  /** Suggestion waiting for the "where to apply" choice. */
  const [choosing, setChoosing] = useState<number | null>(null);
  const appliesDirectly = editable && scheduleStatus === "draft";
  const canApplyToPublished = editable && scheduleStatus === "published";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FixSuggestionView[] | null>(
    null,
  );
  const { pending, run } = useAction();

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
    setOpen(false);
    // A page showing an explicit version follows the new draft.
    const url = new URL(window.location.href);
    if (result.data.createdDraft && url.searchParams.has("version")) {
      url.searchParams.set("version", String(result.data.version));
      router.push(`${url.pathname}?${url.searchParams}`);
    }
  }

  async function load() {
    setChoosing(null);
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await suggestScheduleFixes({ scheduleId, violation });
      if (result.ok) setSuggestions(result.data);
      else setError(result.error);
    } catch {
      setError("Could not compute suggestions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
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
                      Only an administrator can change the published schedule.
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
                    <span className="text-muted-foreground">
                      · {c.dateLabel}
                    </span>
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
      </DialogContent>
    </Dialog>
  );
}
