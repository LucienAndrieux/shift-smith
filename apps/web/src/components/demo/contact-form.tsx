"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { sendContactMessage } from "@/app/(auth)/start/actions";
import { TextareaField } from "@/components/form/fields";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { contactFormSchema } from "@/lib/schemas/contact";
import { MeetingDialog } from "./meeting-dialog";

const EMPTY = { name: "", email: "", company: "", message: "", website: "" };

/** Prospect → developer message, sent by email (see start/actions.ts). */
export function ContactForm() {
  const form = useZodForm(contactFormSchema, EMPTY);
  const { pending, run } = useAction();
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-3 py-6" role="status">
        <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        <p className="text-lg font-semibold">Message sent.</p>
        <p className="text-sm text-muted-foreground">
          I&apos;ll reply to {sentTo}, usually within two working days.
        </p>
        <Button variant="outline" size="sm" onClick={() => setSentTo(null)}>
          Write another message
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        id="contact-form"
        noValidate
        onSubmit={form.submit(async (values) => {
          const result = await run(() => sendContactMessage(values));
          if (result.ok) {
            setSentTo(String(values.email));
            form.reset(EMPTY);
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
          <TextField
            control={form.control}
            name="company"
            label="Company or team (optional)"
            autoComplete="organization"
          />
          <TextareaField
            control={form.control}
            name="message"
            label="Your project"
            rows={5}
            placeholder="How many people, how you plan today, what you would like the tool to do…"
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
        </FieldGroup>
      </form>
      {/* Outside the form: the meeting dialog's own form would otherwise submit
          this one too (React events bubble through portals). */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          form="contact-form"
          size="lg"
          disabled={pending}
          className="bg-[#E8590C] text-white hover:bg-[#cf4f0b]"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Send message
        </Button>
        <span className="text-center text-sm text-muted-foreground">or</span>
        <MeetingDialog />
      </div>
    </div>
  );
}
