"use client";

import { Check, Loader2, RotateCw, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { TextareaField } from "@/components/form/fields";
import { useLocale, useT } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { OperationType } from "@/lib/constraints/operations";
import { formatMonth } from "@/lib/domain/calendar";
import { constraintFormSchema } from "@/lib/schemas/constraints";
import {
  approveConstraint,
  rejectConstraint,
  retryConstraint,
  submitConstraint,
} from "./actions";

type Status = "pending" | "parsed" | "approved" | "rejected" | "failed";

export interface ConstraintItem {
  id: string;
  /** The user may parse it again (managers, or the employee who wrote it). */
  canRetry: boolean;
  rawText: string;
  status: Status;
  model: string | null;
  parseError: string | null;
  createdAt: string;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  summary: string | null;
  /**
   * Parsed constraint with forced shifts in one month: the editable versions of
   * that month, newest first, for the approval's choice.
   */
  placement: {
    label: string;
    published: number | null;
    versions: { id: string; version: number; status: "draft" | "published" }[];
  } | null;
  operations: { type: OperationType; text: string }[];
}

const STATUS_VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  parsed: "default",
  approved: "secondary",
  rejected: "outline",
  failed: "destructive",
};

export function ConstraintsView({
  items,
  canReview,
  canSubmit,
  asEmployee,
}: {
  items: ConstraintItem[];
  /** Approve and reject (managers). */
  canReview: boolean;
  /** Write constraints (managers) or requests (employees). */
  canSubmit: boolean;
  /** Employee guest: the form sends a request about themselves. */
  asEmployee: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const hasPending = items.some((i) => i.status === "pending");

  // Poll while a job is parsing.
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [hasPending, router]);

  return (
    <div className="flex flex-col gap-4">
      {canSubmit && <NewConstraintForm asEmployee={asEmployee} />}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.constraints.none}</p>
      )}
      {items.map((item) => (
        <ConstraintCard key={item.id} item={item} canReview={canReview} />
      ))}
    </div>
  );
}

function NewConstraintForm({ asEmployee }: { asEmployee: boolean }) {
  const t = useT();
  const c = t.constraints;
  const form = useZodForm(constraintFormSchema, {
    rawText: "",
  });
  const { pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {asEmployee ? c.newRequest : c.newConstraint}
        </CardTitle>
        <CardDescription>
          {asEmployee ? c.requestExample : c.constraintExample}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.submit(async (values) => {
            const result = await run(() => submitConstraint(values), {
              success: c.sent,
            });
            if (result.ok) form.reset({ rawText: "" });
          })}
        >
          <FieldGroup>
            <TextareaField
              control={form.control}
              name="rawText"
              label={c.constraint}
              rows={3}
            />
            <div>
              <Button type="submit" disabled={pending}>
                <Sparkles /> {c.parse}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function ConstraintCard({
  item,
  canReview,
}: {
  item: ConstraintItem;
  canReview: boolean;
}) {
  const t = useT();
  const c = t.constraints;
  const locale = useLocale();
  const router = useRouter();
  const { pending, run } = useAction();
  // Where approval puts forced shifts: "new" or a version id. The latest draft
  // by default, else a new copy of the published version.
  const [placement, setPlacement] = useState(
    () =>
      item.placement?.versions.find((v) => v.status === "draft")?.id ?? "new",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-normal whitespace-pre-line">
          “{item.rawText}”
        </CardTitle>
        <CardDescription>
          {item.createdAt}
          {item.createdBy && ` · ${item.createdBy}`}
          {item.model === "example"
            ? ` · ${c.example}`
            : item.model && ` · ${c.model(item.model)}`}
        </CardDescription>
        <CardAction>
          <Badge variant={STATUS_VARIANT[item.status]}>
            {item.status === "pending" && <Loader2 className="animate-spin" />}
            {c.statuses[item.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      {(item.summary || item.operations.length > 0 || item.parseError) && (
        <CardContent className="flex flex-col gap-3">
          {item.summary && <p className="text-sm">{item.summary}</p>}
          {item.operations.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {item.operations.map((op, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: operations are positional
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={
                      op.type === "unparseable" ? "destructive" : "outline"
                    }
                    className="shrink-0"
                  >
                    {t.operations.labels[op.type]}
                  </Badge>
                  <span>{op.text}</span>
                </li>
              ))}
            </ul>
          )}
          {item.parseError && (
            <p className="text-sm whitespace-pre-line text-destructive">
              {item.parseError}
            </p>
          )}
        </CardContent>
      )}
      {((canReview || item.canRetry) &&
        (item.status === "parsed" ||
          item.status === "failed" ||
          item.status === "pending")) ||
      item.reviewedBy ? (
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {item.reviewedBy &&
              c.reviewed(item.reviewedBy, item.reviewedAt ?? "")}
          </span>
          {(canReview || item.canRetry) && (
            <div className="flex gap-2">
              {item.canRetry &&
                (item.status === "failed" || item.status === "pending") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => retryConstraint({ id: item.id }), {
                        success: c.parsingAgain,
                      })
                    }
                  >
                    <RotateCw /> {c.retry}
                  </Button>
                )}
              {canReview &&
                (item.status === "parsed" || item.status === "failed") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => rejectConstraint({ id: item.id }), {
                        success: c.rejected,
                      })
                    }
                  >
                    <X /> {c.reject}
                  </Button>
                )}
              {canReview && item.status === "parsed" && (
                <ConfirmButton
                  title={c.applyTitle}
                  description={c.applyText}
                  confirmLabel={c.approve}
                  destructive={false}
                  action={() =>
                    approveConstraint({
                      id: item.id,
                      placement: !item.placement
                        ? null
                        : placement === "new"
                          ? { kind: "new" }
                          : { kind: "version", scheduleId: placement },
                    })
                  }
                  onSuccess={(versions) => {
                    // Forced shifts may land in a version other than the one
                    // on screen: say which, with a way there.
                    const target = versions[0];
                    if (!target) {
                      toast.success(c.applied);
                      return;
                    }
                    const month = formatMonth(
                      target.year,
                      target.month,
                      locale,
                    );
                    const draft = target.status === "draft";
                    toast.success(
                      draft
                        ? c.appliedToDraft(month, target.version)
                        : c.appliedToPublished(month, target.version),
                      {
                        duration: 15_000,
                        action: {
                          label: draft ? c.openDraft : c.openSchedule,
                          onClick: () =>
                            router.push(
                              `/schedule/${target.year}/${target.month}?version=${target.version}`,
                            ),
                        },
                      },
                    );
                  }}
                  trigger={
                    <Button size="sm">
                      <Check /> {c.approve}
                    </Button>
                  }
                >
                  {item.placement && (
                    <fieldset className="flex flex-col gap-2 text-sm">
                      <legend className="mb-2 font-medium">
                        {c.placeLabel(item.placement.label)}
                      </legend>
                      {[
                        {
                          value: "new",
                          label: c.placeNew(item.placement.published),
                        },
                        ...item.placement.versions.map((v) => ({
                          value: v.id,
                          label:
                            v.status === "draft"
                              ? c.placeDraft(v.version)
                              : c.placePublished(v.version),
                        })),
                      ].map((choice) => (
                        <label
                          key={choice.value}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 has-checked:border-brand/50 has-checked:bg-brand/5"
                        >
                          <input
                            type="radio"
                            name={`placement-${item.id}`}
                            value={choice.value}
                            checked={placement === choice.value}
                            onChange={() => setPlacement(choice.value)}
                            className="mt-0.5 accent-brand"
                          />
                          {choice.label}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </ConfirmButton>
              )}
            </div>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
