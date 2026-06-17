import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

const SUPAVISOR_TRANSACTION_POOLER_OPTIONS = {
  prepare: false,
  max: 1,
  idle_timeout: 20,
} as const;

const client = postgres(getDatabaseUrl(), SUPAVISOR_TRANSACTION_POOLER_OPTIONS);

export const db: PostgresJsDatabase<typeof schema> = drizzle(client, { schema });
