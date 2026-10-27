import { PgBoss } from "pg-boss";

/**
 * pg-boss keeps its queue in Postgres (schema `pgboss`), so no Redis is needed.
 * One instance per server process, shared across hot reloads in development.
 */

export const QUEUES = {
  parseConstraint: "parse-constraint",
  solveSchedule: "solve-schedule",
  /** Demo mode only: hourly guest purge and rolling demo months. */
  demoMaintenance: "demo-maintenance",
} as const;

export interface ParseConstraintJob {
  constraintId: string;
}

export interface SolveScheduleJob {
  runId: string;
}

const globalForBoss = globalThis as unknown as { boss?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  globalForBoss.boss ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const boss = new PgBoss(url);
    boss.on("error", (error) => console.error("[pg-boss]", error));
    await boss.start();
    // The handler records failures itself (status `failed`): no automatic retries.
    await boss.createQueue(QUEUES.parseConstraint, { retryLimit: 0 });
    await boss.createQueue(QUEUES.solveSchedule, {
      retryLimit: 0,
      expireInSeconds: 15 * 60,
    });
    await boss.createQueue(QUEUES.demoMaintenance, { retryLimit: 0 });
    return boss;
  })().catch((error) => {
    globalForBoss.boss = undefined;
    throw error;
  });
  return globalForBoss.boss;
}

export async function enqueueConstraintParse(constraintId: string) {
  const boss = await getBoss();
  await boss.send(QUEUES.parseConstraint, {
    constraintId,
  } satisfies ParseConstraintJob);
}

export async function enqueueSolveSchedule(runId: string) {
  const boss = await getBoss();
  await boss.send(QUEUES.solveSchedule, { runId } satisfies SolveScheduleJob);
}
