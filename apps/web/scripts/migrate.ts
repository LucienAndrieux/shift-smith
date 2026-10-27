import "./load-env";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies the SQL migrations in ./drizzle. Used by `pnpm db:migrate` in development
 * and by the production container at startup (MIGRATIONS_DIR points to the copy in
 * the image).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
