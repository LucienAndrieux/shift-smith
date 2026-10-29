import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  /** Any OpenAI-compatible chat completions API (OpenAI, Groq, Mistral, Ollama…). */
  LLM_API_KEY: z.string().optional().default(""),
  /** Empty = OpenAI. */
  LLM_BASE_URL: z
    .union([z.url(), z.literal("")])
    .optional()
    .default(""),
  LLM_MODEL: z.string().default("gpt-5-nano"),
  SOLVER_URL: z.url().default("http://localhost:8000"),
  /** Visitor quotas (server/demo/limits.ts). */
  DEMO_GENERATIONS_PER_HOUR: z.coerce.number().int().positive().default(3),
  DEMO_LLM_PER_DAY: z.coerce.number().int().positive().default(10),
  DEMO_LLM_GLOBAL_PER_DAY: z.coerce.number().int().positive().default(100),
  /** Shown on the printable monthly sheet. */
  HOTEL_NAME: z.string().default("Demo Alpine Lodge"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated server environment. Parsed lazily so `next build` works without secrets. */
export function env(): ServerEnv {
  if (!cached) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid environment variables:\n${z.prettifyError(result.error)}`,
      );
    }
    cached = result.data;
  }
  return cached;
}
