"use client";

import { CalendarClock, ChevronDown, Loader2, Send } from "lucide-react";
import { useState } from "react";
import {
  getMeetingAvailability,
  requestMeeting,
} from "@/app/(auth)/start/actions";
import { TextareaField } from "@/components/form/fields";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { DaySlots } from "@/lib/meeting-slots";
import { meetingRequestSchema } from "@/lib/schemas/contact";
import { cn } from "@/lib/utils";

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** "Tuesday 3 November 2026" (dates are calendar days, read as UTC noon). */
const dayLabel = (date: string) =>
  DAY_LABEL.format(new Date(`${date}T12:00:00Z`));

const EMPTY = {
  name: "",
  email: "",
  date: "",
  time: "",
  topic: "",
  website: "",
};

type Step = "closed" | "pick" | "details";

/**
 * "Schedule a meeting": first a day and a free 30-minute slot (busy times of the
 * developer's calendar already removed), then the visitor's details; sending
 * emails a calendar invitation.
 */
export function MeetingDialog() {
  const [step, setStep] = useState<Step>("closed");
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ date: string; time: string } | null>(
    null,
  );
  const form = useZodForm(meetingRequestSchema, EMPTY);
  const { pending, run } = useAction();

  /** First page, or the next one after the last listed day. */
  async function load(reset: boolean) {
    setLoading(true);
    setLoadError(false);
    try {
      const after = reset ? undefined : days?.at(-1)?.date;
      const result = await getMeetingAvailability({ after });
      if (!result.ok) throw new Error(result.error);
      const next = reset
        ? result.data.days
        : [...(days ?? []), ...result.data.days];
      setDays(next);
      setMore(result.data.more);
      if (reset) setExpanded(next[0]?.date ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function openPicker() {
    setStep("pick");
    void load(true);
  }

  function choose(date: string, time: string) {
    setChosen({ date, time });
    form.setValue("date", date);
    form.setValue("time", time);
    setStep("details");
  }

  const when = chosen ? `${dayLabel(chosen.date)} at ${chosen.time}` : "";

  return (
    <>
      <Button type="button" variant="outline" size="lg" onClick={openPicker}>
        <CalendarClock /> Schedule a meeting
      </Button>

      {/* Step 1: a day, then a time. */}
      <Dialog
        open={step === "pick"}
        onOpenChange={(open) => !open && setStep("closed")}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose a time for a 30-minute call</DialogTitle>
            <DialogDescription>
              Times are in Paris time. Only the times I&apos;m free are shown.
            </DialogDescription>
          </DialogHeader>

          {days === null && loading && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          )}
          {loadError && (
            <div className="flex flex-col items-start gap-2 text-sm">
              <p className="text-destructive">
                The free times could not be loaded.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => load(days === null)}
              >
                Try again
              </Button>
            </div>
          )}
          {days?.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No free time in the coming weeks: send a message instead.
            </p>
          )}

          {days && days.length > 0 && (
            <ul className="flex flex-col gap-2">
              {days.map((day) => {
                const open = expanded === day.date;
                return (
                  <li key={day.date} className="rounded-lg border">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : day.date)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <span className="flex-1">{dayLabel(day.date)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {day.slots.length}{" "}
                        {day.slots.length === 1 ? "time" : "times"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open && (
                      <div className="grid grid-cols-3 gap-2 border-t p-3 sm:grid-cols-4">
                        {day.slots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => choose(day.date, time)}
                            className="rounded-md bg-sky-500/10 py-2 text-sm font-medium text-sky-800 transition-colors hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-sky-300"
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {days && more && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => load(false)}
              className="w-full"
            >
              {loading && <Loader2 className="animate-spin" />}
              See more dates
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Step 2: who is asking. */}
      <Dialog
        open={step === "details"}
        onOpenChange={(open) => !open && setStep("closed")}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your details</DialogTitle>
            <DialogDescription>
              {when} (Paris time).{" "}
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Change
              </button>
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.submit(async (values) => {
              const result = await run(() => requestMeeting(values), {
                success:
                  "Invitation sent: check your inbox for the confirmation",
              });
              if (result.ok) {
                setStep("closed");
                setChosen(null);
                form.reset(EMPTY);
              } else if (result.fieldErrors?.time) {
                // Taken in the meantime: back to the refreshed list.
                setStep("pick");
                void load(true);
              }
            })}
          >
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="name"
                  label="Your name"
                  autoComplete="name"
                />
                <TextField
                  control={form.control}
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                />
              </div>
              <TextareaField
                control={form.control}
                name="topic"
                label="What would you like to discuss? (optional)"
                rows={3}
              />
              {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
              <input
                {...form.register("website")}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] size-px opacity-0"
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#E8590C] text-white hover:bg-[#cf4f0b]"
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send invitation
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
