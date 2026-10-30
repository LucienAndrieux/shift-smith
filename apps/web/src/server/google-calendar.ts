import "server-only";
import { createSign } from "node:crypto";
import { env } from "@/lib/env";
import type { BusyInterval } from "@/lib/meeting-slots";

/**
 * Busy periods of the developer's Google Calendar, through the free/busy API and
 * a service account the calendar is shared with ("See only free/busy"): no event
 * titles or details ever reach this app.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
/** Busy periods change rarely: a short cache spares the API on every page view. */
const CACHE_MS = 2 * 60 * 1000;

let token: { value: string; expires: number } | null = null;
const cache = new Map<string, { at: number; busy: BusyInterval[] }>();

/** The integration is configured (otherwise every offered slot is shown). */
export function calendarConfigured() {
  const e = env();
  return Boolean(
    e.GOOGLE_CALENDAR_ID &&
      e.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      e.GOOGLE_SERVICE_ACCOUNT_KEY,
  );
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY } = env();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  // The key is usually stored on one line with "\n" escapes in the .env file.
  const key = GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google token: HTTP ${response.status} ${await response.text()}`,
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  token = {
    value: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return token.value;
}

/**
 * Busy periods between two instants, or null when the integration is not
 * configured or Google could not be reached (the caller then shows every slot).
 */
export async function busyIntervals(
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[] | null> {
  if (!calendarConfigured()) return null;
  const key = `${timeMin.toISOString()}|${timeMax.toISOString()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.busy;

  try {
    const calendarId = env().GOOGLE_CALENDAR_ID;
    const response = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      calendars: Record<
        string,
        { busy?: { start: string; end: string }[]; errors?: unknown[] }
      >;
    };
    const calendar = data.calendars[calendarId];
    if (!calendar || calendar.errors?.length) {
      throw new Error(
        `calendar not readable: ${JSON.stringify(calendar?.errors ?? "missing")}`,
      );
    }
    const busy = (calendar.busy ?? []).map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
    cache.set(key, { at: Date.now(), busy });
    return busy;
  } catch (error) {
    console.error("[google-calendar] free/busy failed:", error);
    return null;
  }
}
