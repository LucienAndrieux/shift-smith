import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pgClient?: postgres.Sql;
  db?: Database;
};

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 10 });
  globalForDb.pgClient = client;
  return drizzle(client, { schema, casing: "snake_case" });
}

/**
 * Lazily created so importing this module (e.g. during `next build`) does not
 * require a database. Reused across hot reloads in development.
 */
export function getDb(): Database {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function closeDb() {
  await globalForDb.pgClient?.end();
  globalForDb.pgClient = undefined;
  globalForDb.db = undefined;
}

export { schema };
