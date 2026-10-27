import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
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
 * Sends a plain-text email. Without SMTP_HOST (development) the message is printed
 * to the console instead. Never throws: email failures are logged, not fatal.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const to = Array.isArray(message.to) ? message.to.join(", ") : message.to;
  const transport = getTransporter();
  if (!transport) {
    console.info(
      `\n[email:console] To: ${to}\n[email:console] Subject: ${message.subject}\n${message.text}\n`,
    );
    return;
  }
  try {
    await transport.sendMail({
      from: env().SMTP_FROM,
      to,
      subject: message.subject,
      text: message.text,
    });
  } catch (error) {
    console.error(
      `[email] Failed to send "${message.subject}" to ${to}`,
      error,
    );
  }
}

export function appUrl(path = "/"): string {
  return new URL(path, env().BETTER_AUTH_URL).toString();
}
