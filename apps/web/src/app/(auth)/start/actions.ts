"use server";

import { randomUUID } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";
import { headers } from "next/headers";
import { z } from "zod";
import { APP_TIME_ZONE, today } from "@/lib/dates";
import { addDays, formatDayMonth, weekday } from "@/lib/domain/calendar";
import { env } from "@/lib/env";
import { buildInvitation } from "@/lib/ics";
import { contactFormSchema, meetingRequestSchema } from "@/lib/schemas/contact";
import type { ActionResult } from "@/server/action";
import { sendEmail } from "@/server/email";

const WINDOW_MS = 15 * 60 * 1000;
const PER_ADDRESS = 3;
const PER_DAY = 40;
/** How far ahead a meeting can be booked. */
const MAX_DAYS_AHEAD = 60;
/** Sends per client address in the last WINDOW_MS, and all sends of the day. */
const recent = new Map<string, number[]>();
let sentToday = { day: "", count: 0 };

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

  return send(async (to) =>
    sendEmail({
      to,
      replyTo: email,
      subject: `ShiftSmith: message from ${name}${company ? ` (${company})` : ""}`,
      text: `${name} <${email}>${company ? `\nCompany: ${company}` : ""}\n\n${message}`,
    }),
  );
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

  const start = fromZonedTime(`${date}T${time}:00`, APP_TIME_ZONE);
  const when = `${formatDayMonth(date)} ${date.slice(0, 4)}, ${time} (${APP_TIME_ZONE} time)`;
  return send(async (to) =>
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
  );
}

/** Applies the limits, sends to CONTACT_EMAIL and counts the send. */
async function send(
  deliver: (to: string) => Promise<boolean>,
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
  if (sentToday.day !== day) sentToday = { day, count: 0 };
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
  return { ok: true, data: undefined };
}

function invalid(error: z.ZodError): ActionResult {
  return {
    ok: false,
    error: "Some fields are invalid.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function fieldError(field: string, message: string): ActionResult {
  return { ok: false, error: message, fieldErrors: { [field]: [message] } };
}
