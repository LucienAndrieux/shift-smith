"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { APP_TIME_ZONE, today } from "@/lib/dates";
import { addDays, formatDayMonth, weekday } from "@/lib/domain/calendar";
import { env } from "@/lib/env";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getRequestLocale, getRequestT } from "@/lib/i18n/server";
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
  const t = await getRequestT();
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) return invalid(t, parsed.error);
  const { name, email, company, message, website } = parsed.data;
  if (website) return { ok: true, data: undefined };

  return send(
    t,
    async (to) =>
      sendEmail({
        to,
        replyTo: email,
        subject: `ShiftSmith: message from ${name}${company ? ` (${company})` : ""}`,
        text: `${name} <${email}>${company ? `\nCompany: ${company}` : ""}\n\n${message}`,
      }),
    {
      email,
      subject: t.contact.confirmSubject,
      text: t.contact.confirmText,
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
  if (!parsed.success) return invalid(await getRequestT(), parsed.error);
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
  const [t, locale] = await Promise.all([getRequestT(), getRequestLocale()]);
  const parsed = meetingRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(t, parsed.error);
  const { name, email, date, time, topic, website } = parsed.data;
  if (website) return { ok: true, data: undefined };

  const first = addDays(today(), 1);
  if (date < first || date > addDays(today(), MAX_DAYS_AHEAD)) {
    return fieldError("date", t.meeting.dayRange(MAX_DAYS_AHEAD));
  }
  if (weekday(date) >= 6) {
    return fieldError("date", t.meeting.weekday);
  }

  // The slot may have been taken since the picker was loaded.
  const slot = slotInterval(date, time, APP_TIME_ZONE);
  const busy = await busyIntervals(slot.start, slot.end);
  if (busy && isBusy(slot, busy)) {
    return fieldError("time", t.meeting.taken);
  }
  const start = slot.start;
  const when = `${formatDayMonth(date)} ${date.slice(0, 4)}, ${time} (${APP_TIME_ZONE} time)`;
  // The visitor's copy, in their language.
  const visitorWhen = t.meeting.whenText(
    `${formatDayMonth(date, locale)} ${date.slice(0, 4)}`,
    time,
  );
  return send(
    t,
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
      subject: t.meeting.confirmSubject(visitorWhen),
      text: t.meeting.confirmText(visitorWhen),
    },
  );
}

/**
 * Applies the limits, sends to CONTACT_EMAIL and counts the send, then emails the
 * visitor a confirmation. The confirmation holds fixed text only (the date and
 * time are validated), so the forms cannot relay content to other addresses.
 */
async function send(
  t: Dictionary,
  deliver: (to: string) => Promise<boolean>,
  confirmation: Confirmation,
): Promise<ActionResult> {
  const to = env().CONTACT_EMAIL;
  if (!to) {
    return { ok: false, error: t.contact.notConfigured };
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
      error: t.contact.tooMany,
    };
  }
  if (!(await deliver(to))) {
    return {
      ok: false,
      error: t.contact.sendFailed,
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

function invalid(t: Dictionary, error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: t.common.invalidFields,
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function fieldError(field: string, message: string): ActionResult<never> {
  return { ok: false, error: message, fieldErrors: { [field]: [message] } };
}
