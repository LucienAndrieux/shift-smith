import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildSeedPlan,
  type SeedPlan,
  seedPlanToScheduleInput,
} from "../seed-mapping";
import type { ScheduleInput } from "../types";

export const SEED_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../../docs/seed-data.json",
);

let plan: SeedPlan | undefined;

/** The demo seed file, parsed once. */
export function seedPlan(): SeedPlan {
  plan ??= buildSeedPlan(JSON.parse(readFileSync(SEED_PATH, "utf8")));
  return plan;
}

/** November 2026 demo reference schedule as validator input (natural-key ids). */
export function november2026(): ScheduleInput {
  return structuredClone(seedPlanToScheduleInput(seedPlan()));
}
