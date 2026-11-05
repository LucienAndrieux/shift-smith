import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { db } from "@/db";
import { naturalLanguageConstraints } from "@/db/schema";
import { checkParsedConstraint, NO_DATE } from "@/lib/constraints/check";
import { constraintResponseSchema } from "@/lib/constraints/operations";
import { APP_TIME_ZONE, today as todayInAppZone } from "@/lib/dates";
import { WEEKDAY_SHORT } from "@/lib/domain/calendar";
import { env } from "@/lib/env";
import {
  getDayCodes,
  getEmployees,
  getSections,
  getShiftTypes,
} from "@/server/queries/reference";

const TIMEOUT_MS = 60_000;

/**
 * Parses one stored constraint with an LLM (any OpenAI-compatible chat completions
 * API with JSON-schema structured outputs) and stores the result.
 * Never throws: any failure ends in status `failed` with a readable `parse_error`.
 */
export async function parseConstraint(constraintId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(naturalLanguageConstraints)
    .where(eq(naturalLanguageConstraints.id, constraintId));
  if (!row || (row.status !== "pending" && row.status !== "failed")) return;

  const { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } = env();
  const fail = (message: string) =>
    db
      .update(naturalLanguageConstraints)
      .set({ status: "failed", parseError: message, model: LLM_MODEL })
      .where(eq(naturalLanguageConstraints.id, constraintId));

  if (!LLM_API_KEY) {
    await fail("LLM_API_KEY is not configured.");
    return;
  }

  try {
    const context = await buildContext();
    const client = new OpenAI({
      apiKey: LLM_API_KEY,
      baseURL: LLM_BASE_URL || undefined,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });
    const response = await client.chat.completions.parse({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: context.instructions },
        { role: "user", content: row.rawText },
      ],
      response_format: zodResponseFormat(
        constraintResponseSchema,
        "constraint_operations",
      ),
    });
    const message = response.choices[0]?.message;
    if (!message?.parsed) {
      await fail(
        message?.refusal
          ? `The model refused: ${message.refusal}`
          : "The model returned no structured result.",
      );
      return;
    }
    const { hasDate, ...parsed } = message.parsed;
    // Every request needs a date, except a permanent change of the fixed rest days.
    const permanent =
      parsed.operations.length > 0 &&
      parsed.operations.every((op) => op.type === "days_off_change");
    const problems = [
      ...(hasDate || permanent ? [] : [NO_DATE]),
      ...checkParsedConstraint(parsed, context.references),
    ];
    await db
      .update(naturalLanguageConstraints)
      .set(
        problems.length === 0
          ? {
              status: "parsed",
              parsed,
              parseError: null,
              model: response.model,
            }
          : {
              status: "failed",
              parsed,
              parseError: problems.join("\n"),
              model: response.model,
            },
      )
      .where(eq(naturalLanguageConstraints.id, constraintId));
  } catch (error) {
    const message =
      error instanceof OpenAI.APIConnectionTimeoutError
        ? `The model did not answer within ${TIMEOUT_MS / 1000}s.`
        : error instanceof OpenAI.APIError
          ? `LLM API error ${error.status ?? ""}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
    console.error(`[constraints] parse ${constraintId} failed:`, message);
    await fail(message);
  }
}

async function buildContext() {
  const [employees, sections, shifts, dayCodes] = await Promise.all([
    getEmployees(),
    getSections(),
    getShiftTypes(),
    getDayCodes(),
  ]);
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const today = todayInAppZone();
  const weekday =
    WEEKDAY_SHORT.en[(new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7];

  const instructions = [
    "You turn scheduling notes written by the manager of a small hotel into structured operations.",
    `Today is ${weekday} ${today} (${APP_TIME_ZONE}). Resolve partial or relative dates against today: a day without a month (or a weekday) is the next one from today, "the week of the 9th" is that ISO week, Monday to Sunday.`,
    "Rules:",
    "- Set hasDate to false when the text gives no date or period at all; never invent one.",
    "- Use only ids copied exactly from the lists below. Match people by first name, surname or nickname; accents may be missing.",
    "- An absence (annual leave AL, sick leave SL, etc.) uses the day codes below; ranges are inclusive.",
    '- Sickness, leave, training, a birthday or any other reason that has a day code is always an absence with that code, even when only part of a day is mentioned ("sick on the 7th in the morning" = SL on the 7th): a day code covers the whole day.',
    '- "Can\'t work mornings/evenings/at a given time" is an unavailability with a time window (mornings = 00:00–13:00, afternoons = 13:00–19:00, evenings = 19:00–24:00) unless a specific shift code is named, which is a shift_ban.',
    "- shift_force is for a request that someone works a given shift on a given date: the shift is either named by its code or identified by its hours.",
    '- A wish to start or finish at a given time on a date ("I would like to start at 9:30 on Monday") is a shift_force: look only at the shifts of the employee\'s own section and pick the one whose start (or end) is exactly that time. If no shift or several shifts match, add an `unparseable` operation that names the shifts closest to that time.',
    "- days_off_change is a permanent change of the two weekly fixed rest days.",
    "- staffing_override changes the minimum (and optionally maximum) staff of a section on dates.",
    "- If a sentence is ambiguous or refers to someone or something not in the lists, add an `unparseable` operation explaining why. Never guess an id.",
    "",
    "Employees (id | name | section):",
    ...employees
      .filter((e) => e.status === "active")
      .map(
        (e) =>
          `${e.id} | ${e.displayName}${e.fullName ? ` (${e.fullName})` : ""} | ${e.sectionName}`,
      ),
    "",
    "Sections (id | name):",
    ...sections.map((s) => `${s.id} | ${s.name}`),
    "",
    "Shift types (id | section | code | hours | starts | ends):",
    ...shifts
      .filter((s) => s.isActive)
      .map((s) => {
        const hours = s.label.replace(/^\w · /, "");
        const times = hours.match(/\d{2}:\d{2}/g) ?? [];
        return `${s.id} | ${sectionName.get(s.sectionId)} | ${s.code} | ${hours} | ${times[0] ?? "?"} | ${times.at(-1) ?? "?"}`;
      }),
    "",
    "Day codes (code | meaning | kind):",
    ...dayCodes.map((d) => `${d.code} | ${d.label} | ${d.kind}`),
  ].join("\n");

  return {
    instructions,
    references: {
      employeeIds: new Set(employees.map((e) => e.id)),
      shiftTypeIds: new Set(shifts.map((s) => s.id)),
      sectionIds: new Set(sections.map((s) => s.id)),
      absenceCodes: new Set(
        dayCodes.filter((d) => d.kind === "absence").map((d) => d.code),
      ),
    },
  };
}
