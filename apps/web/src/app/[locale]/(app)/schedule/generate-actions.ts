"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schedules, solverRuns } from "@/db/schema";
import { currentYearMonth, today } from "@/lib/dates";
import { replanStart } from "@/lib/domain/replan";
import {
  generateScheduleSchema,
  replanScheduleSchema,
  solverRunIdSchema,
} from "@/lib/schemas/schedule";
import { ActionError, managerAction } from "@/server/action";
import { audit } from "@/server/audit";
import { assertGenerationAllowed } from "@/server/demo/limits";
import { enqueueSolveSchedule } from "@/server/jobs/boss";
import { buildSolveRequest } from "@/server/solver/run";

/** Queues a full-month generation with the OR-Tools solver (future months only). */
export const startScheduleGeneration = managerAction(
  generateScheduleSchema,
  async ({ year, month, timeLimitSeconds }, user) => {
    const now = currentYearMonth();
    if (year * 12 + month <= now.year * 12 + now.month) {
      throw new ActionError((t) => t.errors.generationFutureOnly);
    }
    await assertGenerationAllowed(user);
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

/**
 * Queues "replan from tomorrow" on a version of the current month: the solver
 * keeps every cell before tomorrow and changes as few cells as it can after
 * (new absences, locks and rules apply). The result is a new draft.
 */
export const startScheduleReplan = managerAction(
  replanScheduleSchema,
  async ({ scheduleId, timeLimitSeconds }, user) => {
    const [schedule] = await db
      .select({
        year: schedules.year,
        month: schedules.month,
        status: schedules.status,
        closedAt: schedules.closedAt,
      })
      .from(schedules)
      .where(eq(schedules.id, scheduleId));
    if (!schedule) throw new ActionError((t) => t.errors.scheduleNotFound);
    if (schedule.status === "archived")
      throw new ActionError((t) => t.errors.archivedReadOnly);
    if (schedule.closedAt)
      throw new ActionError((t) => t.errors.closedReadOnly);
    const { year, month } = schedule;
    const from = replanStart(year, month, today());
    if (!from) throw new ActionError((t) => t.errors.replanCurrentMonthOnly);
    await assertGenerationAllowed(user);
    const [run] = await db
      .insert(solverRuns)
      .values({ year, month, status: "queued", createdBy: user.id })
      .returning({ id: solverRuns.id });
    const input = await buildSolveRequest(
      run.id,
      year,
      month,
      timeLimitSeconds,
      { scheduleId, from },
    );
    await db.update(solverRuns).set({ input }).where(eq(solverRuns.id, run.id));
    await audit(db, {
      userId: user.id,
      action: "replan",
      entity: "solver_run",
      entityId: run.id,
      diff: { scheduleId, year, month, from, timeLimitSeconds },
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

export const getScheduleGeneration = managerAction(
  solverRunIdSchema,
  async ({ runId }, user) => {
    const [run] = await db
      .select({
        status: solverRuns.status,
        error: solverRuns.error,
        output: solverRuns.output,
        version: schedules.version,
        createdBy: solverRuns.createdBy,
      })
      .from(solverRuns)
      .leftJoin(schedules, eq(schedules.id, solverRuns.scheduleId))
      .where(eq(solverRuns.id, runId));
    if (!run || (user.role !== "manager" && run.createdBy !== user.id))
      throw new ActionError((t) => t.errors.generationNotFound);
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
