"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { contactFormSchema } from "@/lib/schemas/contact";
import type { ActionResult } from "@/server/action";
import { sendEmail } from "@/server/email";

const WINDOW_MS = 15 * 60 * 1000;
const PER_ADDRESS = 3;
const PER_DAY = 40;
/** Sends per client address in the last WINDOW_MS, and all sends of the day. */
const recent = new Map<string, number[]>();
let today = { day: "", count: 0 };

/**
 * Public contact form: no session needed. Bots that fill the honeypot get a fake
 * success; real senders are limited per address and per day (in memory, one
 * server process).
 */
export async function sendContactMessage(
  input: z.input<typeof contactFormSchema>,
): Promise<ActionResult> {
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some fields are invalid.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const { name, email, company, message, website } = parsed.data;
  if (website) return { ok: true, data: undefined };

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
  if (today.day !== day) today = { day, count: 0 };
  if (mine.length >= PER_ADDRESS || today.count >= PER_DAY) {
    return {
      ok: false,
      error: "Too many messages for now: try again later or use LinkedIn.",
    };
  }

  const sent = await sendEmail({
    to,
    replyTo: email,
    subject: `ShiftSmith: message from ${name}${company ? ` (${company})` : ""}`,
    text: `${name} <${email}>${company ? `\nCompany: ${company}` : ""}\n\n${message}`,
  });
  if (!sent) {
    return {
      ok: false,
      error: "The message could not be sent: try again or use LinkedIn.",
    };
  }
  recent.set(address, [...mine, now]);
  today.count++;
  return { ok: true, data: undefined };
}
