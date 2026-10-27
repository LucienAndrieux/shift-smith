"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schedules, solverRuns } from "@/db/schema";
import { currentYearMonth } from "@/lib/dates";
import {
  generateScheduleSchema,
  solverRunIdSchema,
} from "@/lib/schemas/schedule";
import { ActionError, adminAction } from "@/server/action";
import { audit } from "@/server/audit";
import { enqueueSolveSchedule } from "@/server/jobs/boss";
import { buildSolveRequest } from "@/server/solver/run";

/** Queues a full-month generation with the OR-Tools solver (future months only). */
export const startScheduleGeneration = adminAction(
  generateScheduleSchema,
  async ({ year, month, timeLimitSeconds }, user) => {
    const now = currentYearMonth();
    if (year * 12 + month <= now.year * 12 + now.month) {
      throw new ActionError(
        "Generation is only available for months after the current one.",
      );
    }
    const [run] = await db
      .insert(solverRuns)
      .values({ year, month, status: "queued", createdBy: user.id })
      .returning({ id: solverRuns.id });
    const input = await buildSolveRequest(
      run.id,
      year,
      month,
      timeLimitSeconds,
    );
    await db.update(solverRuns).set({ input }).where(eq(solverRuns.id, run.id));
    await audit(db, {
      userId: user.id,
      action: "generate",
      entity: "solver_run",
      entityId: run.id,
      diff: { year, month, timeLimitSeconds },
    });
    try {
      await enqueueSolveSchedule(run.id);
    } catch (error) {
      console.error("[solver] enqueue failed", error);
      await db
        .update(solverRuns)
        .set({ status: "failed", error: "Could not queue the generation job." })
        .where(eq(solverRuns.id, run.id));
    }
    return { runId: run.id };
  },
);

export const getScheduleGeneration = adminAction(
  solverRunIdSchema,
  async ({ runId }) => {
    const [run] = await db
      .select({
        status: solverRuns.status,
        error: solverRuns.error,
        output: solverRuns.output,
        version: schedules.version,
      })
      .from(solverRuns)
      .leftJoin(schedules, eq(schedules.id, solverRuns.scheduleId))
      .where(eq(solverRuns.id, runId));
    if (!run) throw new ActionError("Generation not found.");
    const output = run.output as {
      status?: string;
      stats?: { wallTimeSeconds?: number };
    } | null;
    return {
      status: run.status,
      error: run.error,
      version: run.version,
      quality: output?.status ?? null,
      seconds: output?.stats?.wallTimeSeconds ?? null,
    };
  },
  { refreshOnSuccess: false },
);
