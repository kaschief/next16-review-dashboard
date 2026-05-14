import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Database client (libSQL).
 *
 * Same code path serves two deployment shapes:
 *   - Local dev / single-host:  DATABASE_URL=file:./local.db   (default)
 *   - Hosted (e.g. Turso):      DATABASE_URL=libsql://...      + DATABASE_AUTH_TOKEN=...
 *
 * The Drizzle instance is memoised on `globalThis` so Next's dev-mode HMR
 * doesn't spawn a new connection on every hot reload.
 */
const url = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

type DbCache = {
  client?: Client;
  db?: LibSQLDatabase<typeof schema>;
};

const globalForDb = globalThis as unknown as { __dbCache?: DbCache };
const cache: DbCache = (globalForDb.__dbCache ??= {});

cache.client ??= createClient({ url, authToken });
cache.db ??= drizzle(cache.client, { schema });

export const db = cache.db;
export { schema };
