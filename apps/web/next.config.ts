import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "./src/lib/i18n/config";

// The single `.env` file lives at the repository root. Next has already loaded (and
// cached) env files from apps/web, so force a reload from the root.
loadEnvConfig(
  path.resolve(import.meta.dirname, "../.."),
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);

/**
 * Pages live under `app/[locale]/`; URLs carry no language. Every other path is
 * rewritten to the `locale` cookie's language, English by default. Done here and
 * not in proxy.ts: a proxy rewrite counts as external behind `next start -H
 * 127.0.0.1` (the proxy sees "localhost"), and Next then fetches it over the
 * network (500 behind an HTTPS reverse proxy).
 */
const UNLOCALIZED = `/:path((?!(?:${LOCALES.join("|")})(?:/|$)|_next/|api/|.*\\..*).+)`;

function localeRewrites() {
  const byCookie = LOCALES.flatMap((locale) => {
    const has = [
      { type: "cookie" as const, key: LOCALE_COOKIE, value: locale },
    ];
    return [
      { source: "/", has, destination: `/${locale}` },
      { source: UNLOCALIZED, has, destination: `/${locale}/:path` },
    ];
  });
  return [
    ...byCookie,
    { source: "/", destination: `/${DEFAULT_LOCALE}` },
    { source: UNLOCALIZED, destination: `/${DEFAULT_LOCALE}/:path` },
  ];
}

const nextConfig: NextConfig = {
  // Before the file system: otherwise /start would match /[locale] itself.
  async rewrites() {
    return { beforeFiles: localeRewrites(), afterFiles: [], fallback: [] };
  },
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
