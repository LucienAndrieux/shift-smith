/**
 * Starts the pg-boss worker inside the Next.js server process (Node.js runtime only).
 * Not awaited: a slow or unavailable database must not block the server start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_JOB_WORKER === "true") return;
  const { startWorkers } = await import("./server/jobs/worker");
  void startWorkers();
}
