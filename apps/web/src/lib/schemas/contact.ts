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

/** Start times offered for a 30-minute call (developer's time zone), 09:00–17:30. */
export const MEETING_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const minutes = 9 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

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
