import { parseConstraint } from "@/server/constraints/parse";
import { runSolver } from "@/server/solver/run";
import {
  getBoss,
  type ParseConstraintJob,
  QUEUES,
  type SolveScheduleJob,
} from "./boss";

const globalForWorker = globalThis as unknown as { workersStarted?: boolean };

/** Registers the job handlers. Called once per server process from instrumentation. */
export async function startWorkers() {
  if (globalForWorker.workersStarted) return;
  globalForWorker.workersStarted = true;
  try {
    const boss = await getBoss();
    await boss.work<ParseConstraintJob>(
      QUEUES.parseConstraint,
      async (jobs) => {
        for (const job of jobs) {
          await parseConstraint(job.data.constraintId);
        }
      },
    );
    await boss.work<SolveScheduleJob>(QUEUES.solveSchedule, async (jobs) => {
      for (const job of jobs) {
        await runSolver(job.data.runId);
      }
    });
    console.info("[jobs] worker started");
  } catch (error) {
    globalForWorker.workersStarted = false;
    console.error("[jobs] could not start the worker:", error);
  }
}
