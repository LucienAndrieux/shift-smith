import "server-only";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { naturalLanguageConstraints, solverRuns } from "@/db/schema";
import { env } from "@/lib/env";
import { ActionError } from "@/server/action";
import type { CurrentUser } from "@/server/session";

/**
 * Quotas of the showcase, for every visitor. They protect the server (one OR-Tools
 * run at a time) and the LLM provider's free tier.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function assertGenerationAllowed(user: CurrentUser) {
  const [busy] = await db
    .select({ n: count() })
    .from(solverRuns)
    .where(inArray(solverRuns.status, ["queued", "running"]));
  if ((busy?.n ?? 0) > 0) {
    throw new ActionError(
      "Another visitor's schedule is being generated: try again in a minute.",
    );
  }
  const [mine] = await db
    .select({ n: count() })
    .from(solverRuns)
    .where(
      and(
        eq(solverRuns.createdBy, user.id),
        gte(solverRuns.createdAt, new Date(Date.now() - HOUR)),
      ),
    );
  const max = env().DEMO_GENERATIONS_PER_HOUR;
  if ((mine?.n ?? 0) >= max) {
    throw new ActionError(`The demo allows ${max} generations per hour.`);
  }
}

export async function assertLlmAllowed(user: CurrentUser) {
  const since = new Date(Date.now() - DAY);
  const [mine, all] = await Promise.all([
    db
      .select({ n: count() })
      .from(naturalLanguageConstraints)
      .where(
        and(
          eq(naturalLanguageConstraints.createdBy, user.id),
          gte(naturalLanguageConstraints.createdAt, since),
        ),
      ),
    db
      .select({ n: count() })
      .from(naturalLanguageConstraints)
      .where(gte(naturalLanguageConstraints.createdAt, since)),
  ]);
  const { DEMO_LLM_PER_DAY, DEMO_LLM_GLOBAL_PER_DAY } = env();
  if ((mine[0]?.n ?? 0) >= DEMO_LLM_PER_DAY) {
    throw new ActionError(
      `The demo allows ${DEMO_LLM_PER_DAY} constraints per visitor per day.`,
    );
  }
  if ((all[0]?.n ?? 0) >= DEMO_LLM_GLOBAL_PER_DAY) {
    throw new ActionError(
      "The demo's daily AI quota is used up: try again tomorrow.",
    );
  }
}
