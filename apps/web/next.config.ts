import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// The single `.env` file lives at the repository root. Next has already loaded (and
// cached) env files from apps/web, so force a reload from the root.
loadEnvConfig(
  path.resolve(import.meta.dirname, "../.."),
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);

const nextConfig: NextConfig = {
  // Docker builds a standalone server (NEXT_OUTPUT=standalone in the Dockerfile);
  // the native Windows install runs `next start` from the repository.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // infra/windows/update.ps1 builds into a side folder while the live server keeps
  // serving `.next`, then swaps the two.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Trace files from the monorepo root so the standalone build includes workspace deps.
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  // These use Node APIs; keep them out of the server bundle.
  serverExternalPackages: ["pg-boss", "postgres", "nodemailer", "pdfkit"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
