import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/shared/db/schema";

/**
 * Conexão OWNER do worker (#39) — direta/unpooled (`DATABASE_URL_UNPOOLED`), fora
 * do `app_runtime`, para o claim cross-tenant da fila (contrato 023). NÃO importa
 * `server-only` (o worker roda com `--conditions=react-server`, mas este módulo é
 * exclusivo do worker). A escrita do resultado usa `withOrg` (app_runtime), não isto.
 */
export type OwnerDbHandle = {
  db: PostgresJsDatabase<typeof schema>;
  close: () => Promise<void>;
};

export function createOwnerDb(): OwnerDbHandle {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED is not set (worker owner connection).");
  }
  const client = postgres(url, { max: 1, prepare: false });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
