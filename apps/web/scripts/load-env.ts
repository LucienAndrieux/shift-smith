import { existsSync } from "node:fs";
import path from "node:path";
import * as nextEnv from "@next/env";

/** Repository root: the closest parent directory containing pnpm-workspace.yaml. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
  return dir;
}

// @next/env is CommonJS: named exports exist when bundled as CJS (drizzle-kit), and
// only under `default` when imported from native ESM (tsx scripts).
const { loadEnvConfig } =
  (nextEnv as unknown as { default?: typeof nextEnv }).default ?? nextEnv;

// Scripts run outside Next.js: load the root `.env` the same way next.config.ts does.
loadEnvConfig(findRepoRoot(), process.env.NODE_ENV !== "production");
