import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRuntimeDatabaseUrl } from "./env";
import * as schema from "./schema";

// `prepare: false` is required: Supavisor transaction mode dispatches each
// query to a different Postgres connection, breaking shared prepared statements.
// `max: 1` keeps serverless invocations from stacking connections — the real
// pool lives in Supavisor.
const client = postgres(getRuntimeDatabaseUrl(), {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(client, { schema });
