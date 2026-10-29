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
