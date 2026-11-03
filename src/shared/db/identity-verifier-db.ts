import "server-only";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ForbiddenError } from "@/shared/auth/errors";

import * as schema from "./schema";

/**
 * Conexão do operador de verificação de identidade (NOB-158): conta de login membro do papel
 * `identity_verifier`, provisionada pela infraestrutura e lida de `IDENTITY_VERIFIER_DATABASE_URL`
 * só no servidor. NÃO é a conta de migrations nem o `app_runtime`. Sem a variável, a verificação
 * fica indisponível e o acesso clínico continua bloqueado (falha fechada).
 */
let client: ReturnType<typeof postgres> | null = null;
let clientUrl: string | null = null;

export type VerifierTransaction = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]
>[0];

export const VERIFIER_UNAVAILABLE =
  "Verificação de identidade indisponível: operador da plataforma não configurado.";

export function verifierConfigured(): boolean {
  return Boolean(process.env.IDENTITY_VERIFIER_DATABASE_URL);
}

export async function withVerifier<T>(
  actorUserId: string,
  fn: (tx: VerifierTransaction) => Promise<T>,
): Promise<T> {
  const url = process.env.IDENTITY_VERIFIER_DATABASE_URL;
  if (!url) throw new ForbiddenError(VERIFIER_UNAVAILABLE);
  if (!client || clientUrl !== url) {
    client = postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
    clientUrl = url;
  }
  const db = drizzle(client, { schema });
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${actorUserId}, true)`);
    return fn(tx);
  });
}

/** Encerra a conexão do operador (testes). */
export async function closeVerifierConnection(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = null;
  clientUrl = null;
}
