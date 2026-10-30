import { z } from "zod";

/** Contact form of the start page (a prospect writing to the developer). */
export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").max(200),
  company: z.string().trim().max(150).default(""),
  message: z
    .string()
    .trim()
    .min(20, "Tell me a bit more (20 characters at least).")
    .max(4000, "Keep it under 4,000 characters."),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(200).default(""),
});

export type ContactFormInput = z.input<typeof contactFormSchema>;

/** Start times between two "HH:MM" bounds (both included), every 30 minutes. */
function startTimes(from: string, to: string): string[] {
  const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let m = minutes(from); m <= minutes(to); m += 30) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return out;
}

/**
 * Start times offered for a 30-minute call, in the developer's time zone: the
 * morning and early afternoon, then the early evening (busy from 15:00 to 17:00).
 */
export const MEETING_SLOTS = [
  ...startTimes("09:00", "14:30"),
  ...startTimes("17:00", "18:30"),
];

/** "Schedule a meeting": the visitor sends a 30-minute invitation. */
export const meetingRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").max(200),
  date: z.iso.date("Choose a day."),
  time: z.enum(MEETING_SLOTS, "Choose a time."),
  topic: z.string().trim().max(1000).default(""),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(200).default(""),
});

export type MeetingRequestInput = z.input<typeof meetingRequestSchema>;
