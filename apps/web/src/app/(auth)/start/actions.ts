"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { APP_TIME_ZONE, today } from "@/lib/dates";
import { addDays, formatDayMonth, weekday } from "@/lib/domain/calendar";
import { env } from "@/lib/env";
import { buildInvitation } from "@/lib/ics";
import {
  type DaySlots,
  freeSlots,
  isBusy,
  meetingDays,
  slotInterval,
} from "@/lib/meeting-slots";
import { contactFormSchema, meetingRequestSchema } from "@/lib/schemas/contact";
import type { ActionResult } from "@/server/action";
import { sendEmail } from "@/server/email";
import { busyIntervals } from "@/server/google-calendar";

const WINDOW_MS = 15 * 60 * 1000;
const PER_ADDRESS = 3;
const PER_DAY = 40;
/** Confirmation copies a visitor address can receive per day. */
const COPIES_PER_RECIPIENT = 3;
/** How far ahead a meeting can be booked. */
const MAX_DAYS_AHEAD = 60;
/** Weekdays listed per page of the meeting picker ("See more dates"). */
const DAYS_PER_PAGE = 7;
/** Sends per client address in the last WINDOW_MS, and all sends of the day. */
const recent = new Map<string, number[]>();
let sentToday = { day: "", count: 0 };
/** Confirmation copies sent today, per visitor address. */
const copiesToday = new Map<string, number>();

/** Fixed text sent back to the visitor (never any of their input). */
interface Confirmation {
  email: string;
  subject: string;
  text: string;
}

/**
 * Public forms of the start page (no session): a message, or a 30-minute meeting
 * invitation. Bots that fill the honeypot get a fake success; real senders are
 * limited per address and per day (in memory, one server process).
 */
export async function sendContactMessage(
  input: z.input<typeof contactFormSchema>,
): Promise<ActionResult> {
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, company, message, website } = parsed.data;
  if (website) return { ok: true, data: undefined };

  return send(
    async (to) =>
      sendEmail({
        to,
        replyTo: email,
        subject: `ShiftSmith: message from ${name}${company ? ` (${company})` : ""}`,
        text: `${name} <${email}>${company ? `\nCompany: ${company}` : ""}\n\n${message}`,
      }),
    {
      email,
      subject: "Your message about a scheduling app was sent",
      text: "Hello,\n\nThanks for your message sent from the ShiftSmith demo. I usually reply within two working days.\n\nLucien Andrieux",
    },
  );
}

/**
 * Free 30-minute slots of the next weekdays (from tomorrow), after the given day
 * for the following pages. Days without any free slot are left out.
 */
export async function getMeetingAvailability(input: {
  after?: string;
}): Promise<ActionResult<{ days: DaySlots[]; more: boolean }>> {
  const parsed = z.object({ after: z.iso.date().optional() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const first = addDays(today(), 1);
  const last = addDays(today(), MAX_DAYS_AHEAD);
  const after = parsed.data.after;
  const from = after && after >= first ? addDays(after, 1) : first;
  const days = meetingDays(from, DAYS_PER_PAGE, last);
  const lastDay = days.at(-1);
  if (!lastDay) return { ok: true, data: { days: [], more: false } };

  const busy =
    (await busyIntervals(
      slotInterval(days[0], "00:00", APP_TIME_ZONE).start,
      slotInterval(lastDay, "23:30", APP_TIME_ZONE).end,
    )) ?? [];
  return {
    ok: true,
    data: {
      days: freeSlots(days, busy, APP_TIME_ZONE).filter(
        (d) => d.slots.length > 0,
      ),
      more: meetingDays(addDays(lastDay, 1), 1, last).length > 0,
    },
  };
}

export async function requestMeeting(
  input: z.input<typeof meetingRequestSchema>,
): Promise<ActionResult> {
  const parsed = meetingRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, date, time, topic, website } = parsed.data;
  if (website) return { ok: true, data: undefined };

  const first = addDays(today(), 1);
  if (date < first || date > addDays(today(), MAX_DAYS_AHEAD)) {
    return fieldError(
      "date",
      `Choose a day between tomorrow and ${MAX_DAYS_AHEAD} days from now.`,
    );
  }
  if (weekday(date) >= 6) {
    return fieldError("date", "Choose a weekday (Monday to Friday).");
  }

  // The slot may have been taken since the picker was loaded.
  const slot = slotInterval(date, time, APP_TIME_ZONE);
  const busy = await busyIntervals(slot.start, slot.end);
  if (busy && isBusy(slot, busy)) {
    return fieldError(
      "time",
      "This time is no longer free: choose another one.",
    );
  }
  const start = slot.start;
  const when = `${formatDayMonth(date)} ${date.slice(0, 4)}, ${time} (${APP_TIME_ZONE} time)`;
  return send(
    async (to) =>
      sendEmail({
        to,
        replyTo: email,
        subject: `ShiftSmith: ${name} invites you to a call on ${when}`,
        text: `${name} <${email}> would like a 30-minute call on ${when}.${topic ? `\n\nTopic:\n${topic}` : ""}\n\nAccept or decline the invitation to answer them.`,
        icalEvent: {
          method: "REQUEST",
          content: buildInvitation({
            uid: `${randomUUID()}@shiftsmith`,
            start,
            minutes: 30,
            summary: `Call with ${name} (ShiftSmith)`,
            description: topic || "Custom scheduling app",
            organizer: { name, email },
            attendee: { name: "ShiftSmith", email: to },
          }),
        },
      }),
    {
      email,
      subject: `Your call request for ${when} was sent`,
      text: `Hello,\n\nYour request for a 30-minute call on ${when} was sent from the ShiftSmith demo. You'll get my answer by email: an acceptance of the invitation, or another time if this one doesn't suit.\n\nLucien Andrieux`,
    },
  );
}

/**
 * Applies the limits, sends to CONTACT_EMAIL and counts the send, then emails the
 * visitor a confirmation. The confirmation holds fixed text only (the date and
 * time are validated), so the forms cannot relay content to other addresses.
 */
async function send(
  deliver: (to: string) => Promise<boolean>,
  confirmation: Confirmation,
): Promise<ActionResult> {
  const to = env().CONTACT_EMAIL;
  if (!to) {
    return { ok: false, error: "The contact form is not configured yet." };
  }
  const address =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const now = Date.now();
  const mine = (recent.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  const day = new Date(now).toISOString().slice(0, 10);
  if (sentToday.day !== day) {
    sentToday = { day, count: 0 };
    copiesToday.clear();
  }
  if (mine.length >= PER_ADDRESS || sentToday.count >= PER_DAY) {
    return {
      ok: false,
      error: "Too many messages for now: try again later or use LinkedIn.",
    };
  }
  if (!(await deliver(to))) {
    return {
      ok: false,
      error: "This could not be sent: try again or use LinkedIn.",
    };
  }
  recent.set(address, [...mine, now]);
  sentToday.count++;

  const recipient = confirmation.email.toLowerCase();
  const copies = copiesToday.get(recipient) ?? 0;
  if (copies < COPIES_PER_RECIPIENT) {
    copiesToday.set(recipient, copies + 1);
    // The request is already delivered: a failed copy is only logged.
    await sendEmail({
      to: confirmation.email,
      replyTo: to,
      subject: confirmation.subject,
      text: confirmation.text,
    });
  }
  return { ok: true, data: undefined };
}

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Some fields are invalid.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function fieldError(field: string, message: string): ActionResult<never> {
  return { ok: false, error: message, fieldErrors: { [field]: [message] } };
}
