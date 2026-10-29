"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { requestMeeting } from "@/app/(auth)/start/actions";
import { SelectField, TextareaField } from "@/components/form/fields";
import { FormDialog } from "@/components/form/form-dialog";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { MEETING_SLOTS, meetingRequestSchema } from "@/lib/schemas/contact";

const TIME_OPTIONS = MEETING_SLOTS.map((t) => ({ value: t, label: t }));

/** Tomorrow in the visitor's calendar, the earliest day the form offers. */
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Schedule a meeting": the visitor sends a 30-minute calendar invitation. */
export function MeetingDialog() {
  // Set after mount: reading the clock while rendering breaks prerendering.
  const [minDate, setMinDate] = useState<string>();
  useEffect(() => setMinDate(tomorrow()), []);
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline" size="lg">
          <CalendarClock /> Schedule a meeting
        </Button>
      }
      title="Schedule a 30-minute call"
      description="Pick a weekday and a time (Paris time). I receive a calendar invitation from your address and accept it, or reply with another time."
      schema={meetingRequestSchema}
      defaultValues={{
        name: "",
        email: "",
        date: "",
        time: "",
        topic: "",
        website: "",
      }}
      action={requestMeeting}
      submitLabel="Send invitation"
      successMessage="Invitation sent: you'll get my answer by email"
    >
      {(form) => (
        <>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="date"
              label="Day"
              type="date"
              min={minDate}
            />
            <SelectField
              control={form.control}
              name="time"
              label="Time (Paris)"
              options={TIME_OPTIONS}
              placeholder="Choose a time"
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
        </>
      )}
    </FormDialog>
  );
}
