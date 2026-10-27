import { currentYearMonth } from "@/lib/dates";
import { env } from "@/lib/env";
import { parseConstraint } from "@/server/constraints/parse";
import { purgeExpiredGuests } from "@/server/demo/guests";
import { ensureDemoMonth } from "@/server/demo/reset";
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
    if (env().DEMO_MODE) {
      await boss.work(QUEUES.demoMaintenance, async () => {
        await demoMaintenance();
      });
      await boss.schedule(QUEUES.demoMaintenance, "5 * * * *");
      void demoMaintenance();
    }
    console.info("[jobs] worker started");
  } catch (error) {
    globalForWorker.workersStarted = false;
    console.error("[jobs] could not start the worker:", error);
  }
}

/** Removes expired guests and moves the demo data to the current month if needed. */
async function demoMaintenance() {
  try {
    const purged = await purgeExpiredGuests();
    if (purged > 0) console.info(`[demo] ${purged} expired guest(s) removed`);
    await ensureDemoMonth(currentYearMonth());
  } catch (error) {
    console.error("[demo] maintenance failed:", error);
  }
}
