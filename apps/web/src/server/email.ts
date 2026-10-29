import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Where a reply goes (the visitor who wrote through the contact form). */
  replyTo?: string;
  /** Calendar invitation (iCalendar text, METHOD:REQUEST). */
  icalEvent?: { method: "REQUEST"; content: string };
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env();
  transporter = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
      })
    : null;
  return transporter;
}

/**
 * Sends a plain-text email; without SMTP_HOST (development) it is printed to the
 * console. Returns false when sending failed (the error is logged).
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.info(
      `\n[email:console] To: ${message.to}\n[email:console] Reply-To: ${message.replyTo ?? "-"}\n[email:console] Subject: ${message.subject}\n${message.text}\n${message.icalEvent?.content ?? ""}`,
    );
    return true;
  }
  try {
    await transport.sendMail({ from: env().SMTP_FROM, ...message });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${message.subject}"`, error);
    return false;
  }
}
