import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { db } from "@/db";
import { naturalLanguageConstraints } from "@/db/schema";
import { checkParsedConstraint } from "@/lib/constraints/check";
import { parsedConstraintSchema } from "@/lib/constraints/operations";
import { APP_TIME_ZONE, today as todayInAppZone } from "@/lib/dates";
import { formatMonth, WEEKDAY_SHORT } from "@/lib/domain/calendar";
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
    const context = await buildContext(row.targetYear, row.targetMonth);
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
        parsedConstraintSchema,
        "constraint_operations",
      ),
    });
    const message = response.choices[0]?.message;
    const parsed = message?.parsed;
    if (!parsed) {
      await fail(
        message?.refusal
          ? `The model refused: ${message.refusal}`
          : "The model returned no structured result.",
      );
      return;
    }
    const problems = checkParsedConstraint(parsed, context.references);
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

async function buildContext(year: number, month: number) {
  const [employees, sections, shifts, dayCodes] = await Promise.all([
    getEmployees(),
    getSections(),
    getShiftTypes(),
    getDayCodes(),
  ]);
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const today = todayInAppZone();
  const weekday =
    WEEKDAY_SHORT[(new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7];

  const instructions = [
    "You turn scheduling notes written by the manager of a small hotel into structured operations.",
    `Today is ${weekday} ${today} (${APP_TIME_ZONE}). The target month is ${formatMonth(year, month)}: resolve partial or relative dates against it (e.g. "the week of the 9th" = that ISO week, Monday to Sunday).`,
    "Rules:",
    "- Use only ids copied exactly from the lists below. Match people by first name, surname or nickname; accents may be missing.",
    "- An absence (annual leave AL, sick leave SL, etc.) uses the day codes below; ranges are inclusive.",
    '- "Can\'t work mornings/evenings/at a given time" is an unavailability with a time window (mornings = 00:00–13:00, afternoons = 13:00–19:00, evenings = 19:00–24:00) unless a specific shift code is named, which is a shift_ban.',
    "- shift_force is only for an explicit request that someone works a given shift on a given date.",
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
    "Shift types (id | section | code | hours):",
    ...shifts
      .filter((s) => s.isActive)
      .map(
        (s) =>
          `${s.id} | ${sectionName.get(s.sectionId)} | ${s.code} | ${s.label.replace(/^\w · /, "")}`,
      ),
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
