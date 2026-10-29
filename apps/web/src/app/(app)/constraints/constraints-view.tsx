"use client";

import { Check, Loader2, RotateCw, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { TextareaField } from "@/components/form/fields";
import { TextField } from "@/components/form/text-field";
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
import { OPERATION_LABELS } from "@/lib/constraints/operations";
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
  target: string;
  status: Status;
  model: string | null;
  parseError: string | null;
  createdAt: string;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  summary: string | null;
  /** The text names other months than the target month. */
  monthWarning: string | null;
  operations: { type: keyof typeof OPERATION_LABELS; text: string }[];
}

const STATUS_STYLE: Record<
  Status,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  pending: { label: "Parsing…", variant: "outline" },
  parsed: { label: "Ready for review", variant: "default" },
  approved: { label: "Approved", variant: "secondary" },
  rejected: { label: "Rejected", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

export function ConstraintsView({
  items,
  canReview,
  canSubmit,
  asEmployee,
  defaultTarget,
}: {
  items: ConstraintItem[];
  /** Approve and reject (managers). */
  canReview: boolean;
  /** Write constraints (managers) or requests (employees). */
  canSubmit: boolean;
  /** Employee guest: the form sends a request about themselves. */
  asEmployee: boolean;
  defaultTarget: string;
}) {
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
      {canSubmit && (
        <NewConstraintForm
          defaultTarget={defaultTarget}
          asEmployee={asEmployee}
        />
      )}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No constraints yet.</p>
      )}
      {items.map((item) => (
        <ConstraintCard key={item.id} item={item} canReview={canReview} />
      ))}
    </div>
  );
}

function NewConstraintForm({
  defaultTarget,
  asEmployee,
}: {
  defaultTarget: string;
  asEmployee: boolean;
}) {
  const form = useZodForm(constraintFormSchema, {
    rawText: "",
    target: defaultTarget,
  });
  const { pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {asEmployee ? "New request" : "New constraint"}
        </CardTitle>
        <CardDescription>
          {asEmployee
            ? "Written in your name and sent to the managers, for example: “I can't work mornings the week of Dec 7” or “I would like Dec 18 off”."
            : "For example: “Priya can't work mornings the week of Dec 7” or “Jonas is on sick leave until Dec 18”."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.submit(async (values) => {
            const result = await run(() => submitConstraint(values), {
              success: "Sent for parsing",
            });
            if (result.ok) form.reset({ rawText: "", target: values.target });
          })}
        >
          <FieldGroup>
            <TextareaField
              control={form.control}
              name="rawText"
              label="Constraint"
              rows={3}
            />
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-48">
                <TextField
                  control={form.control}
                  name="target"
                  label="Target month"
                  type="month"
                />
              </div>
              <Button type="submit" disabled={pending}>
                <Sparkles /> Parse
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
  const { pending, run } = useAction();
  const style = STATUS_STYLE[item.status];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-normal whitespace-pre-line">
          “{item.rawText}”
        </CardTitle>
        <CardDescription>
          Target {item.target} · {item.createdAt}
          {item.createdBy && ` · ${item.createdBy}`}
          {item.model === "example"
            ? " · example"
            : item.model && ` · model ${item.model}`}
        </CardDescription>
        <CardAction>
          <Badge variant={style.variant}>
            {item.status === "pending" && <Loader2 className="animate-spin" />}
            {style.label}
          </Badge>
        </CardAction>
      </CardHeader>
      {(item.summary || item.operations.length > 0 || item.parseError) && (
        <CardContent className="flex flex-col gap-3">
          {item.summary && <p className="text-sm">{item.summary}</p>}
          {item.monthWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {item.monthWarning}
            </p>
          )}
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
                    {OPERATION_LABELS[op.type]}
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
              `Reviewed by ${item.reviewedBy} on ${item.reviewedAt}`}
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
                        success: "Parsing again",
                      })
                    }
                  >
                    <RotateCw /> Retry
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
                        success: "Rejected",
                      })
                    }
                  >
                    <X /> Reject
                  </Button>
                )}
              {canReview && item.status === "parsed" && (
                <ConfirmButton
                  title="Apply these operations?"
                  description="Each operation is written to its table (absences, unavailabilities, staffing overrides, fixed days off or a locked draft cell) with source “constraint”."
                  confirmLabel="Approve"
                  successMessage="Constraint applied"
                  action={() => approveConstraint({ id: item.id })}
                  trigger={
                    <Button size="sm">
                      <Check /> Approve
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
