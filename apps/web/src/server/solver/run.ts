import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  hourBankEntries,
  scheduleAssignments,
  schedules,
  solverRuns,
} from "@/db/schema";
import { formatMonth, monthDates } from "@/lib/domain/calendar";
import { env } from "@/lib/env";
import {
  loadAssignments,
  loadMonthContext,
  loadPreviousMonthTail,
} from "@/server/month-context";
import { nextScheduleVersion } from "@/server/schedule-versions";

/**
 * Schedule generation with the OR-Tools service (services/solver). The request
 * follows the contract in services/solver/README.md; the result becomes a new
 * draft (source = solver) that the validator checks like any other version.
 */

export interface SolveResponse {
  runId: string;
  status: "optimal" | "feasible" | "infeasible";
  assignments: {
    employeeId: string;
    date: string;
    shiftTypeId: string | null;
    dayCode: string | null;
    isLocked: boolean;
  }[];
  objective: number | null;
  stats: {
    wallTimeSeconds: number;
    conflicts: number;
    branches: number;
  } | null;
  infeasibility: { message?: string }[];
}

/** Everything the solver needs for one month. */
export async function buildSolveRequest(
  runId: string,
  year: number,
  month: number,
  timeLimitSeconds: number,
) {
  const first = monthDates(year, month)[0];
  const [context, previousAssignments, balances, latest] = await Promise.all([
    loadMonthContext(db, year, month),
    loadPreviousMonthTail(db, year, month),
    db
      .select({
        employeeId: hourBankEntries.employeeId,
        balanceMinutes: sql<number>`sum(${hourBankEntries.minutes})::integer`,
      })
      .from(hourBankEntries)
      .where(lt(hourBankEntries.entryDate, first))
      .groupBy(hourBankEntries.employeeId),
    // Locked cells of the month's latest editable version are kept by the solver.
    db
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.year, year),
          eq(schedules.month, month),
          ne(schedules.status, "archived"),
        ),
      )
      .orderBy(desc(schedules.version))
      .limit(1),
  ]);
  const lockedAssignments = latest[0]
    ? (await loadAssignments(db, latest[0].id)).filter((a) => a.isLocked)
    : [];
  return {
    runId,
    ...context,
    lockedAssignments,
    previousAssignments,
    hourBankBalances: balances,
    options: { timeLimitSeconds },
  };
}

/** pg-boss job: call the solver, store its output and create the draft. */
export async function runSolver(runId: string) {
  const [run] = await db
    .select()
    .from(solverRuns)
    .where(eq(solverRuns.id, runId));
  if (run?.status !== "queued") return;
  await db
    .update(solverRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(solverRuns.id, runId));

  const fail = (
    status: "failed" | "infeasible",
    error: string,
    output?: unknown,
  ) =>
    db
      .update(solverRuns)
      .set({ status, error, output: output ?? null, finishedAt: new Date() })
      .where(eq(solverRuns.id, runId));

  try {
    const input = run.input as { options: { timeLimitSeconds: number } };
    const response = await fetch(new URL("/solve", env().SOLVER_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run.input),
      signal: AbortSignal.timeout((input.options.timeLimitSeconds + 60) * 1000),
    });
    if (!response.ok) {
      await fail(
        "failed",
        `Solver error ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
      return;
    }
    const result = (await response.json()) as SolveResponse;
    if (result.status === "infeasible") {
      await fail(
        "infeasible",
        result.infeasibility
          .map((i) => i.message)
          .filter(Boolean)
          .join(" ") || "No schedule satisfies the hard rules.",
        result,
      );
      return;
    }

    await db.transaction(async (tx) => {
      const version = await nextScheduleVersion(run.year, run.month);
      const [draft] = await tx
        .insert(schedules)
        .values({
          year: run.year,
          month: run.month,
          version,
          status: "draft",
          source: "solver",
          title: `${formatMonth(run.year, run.month)} — generated v${version}`,
          // The draft belongs to whoever asked for it.
          createdBy: run.createdBy,
        })
        .returning({ id: schedules.id });
      if (result.assignments.length > 0) {
        await tx.insert(scheduleAssignments).values(
          result.assignments.map((a) => ({
            scheduleId: draft.id,
            employeeId: a.employeeId,
            date: a.date,
            shiftTypeId: a.shiftTypeId,
            dayCode: a.dayCode,
            isLocked: a.isLocked,
          })),
        );
      }
      await tx
        .update(solverRuns)
        .set({
          status: "succeeded",
          scheduleId: draft.id,
          output: {
            status: result.status,
            objective: result.objective,
            stats: result.stats,
          },
          finishedAt: new Date(),
        })
        .where(eq(solverRuns.id, runId));
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The solver did not answer in time."
        : error instanceof Error
          ? `Could not reach the solver: ${error.message}`
          : String(error);
    console.error(`[solver] run ${runId} failed:`, message);
    await fail("failed", message);
  }
}
