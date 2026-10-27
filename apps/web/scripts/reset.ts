import postgres from "postgres";
import "./load-env";

/**
 * Drops every schema the app owns (tables, migration journal, job queue) so that
 * `pnpm db:migrate && pnpm db:seed` starts from an empty database. Refuses to run
 * against anything but a local database.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to reset a non-local database (${host}).`);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`
      drop schema if exists public cascade;
      drop schema if exists drizzle cascade;
      drop schema if exists pgboss cascade;
      create schema public;
    `);
    console.log(`Database reset (${host}).`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
