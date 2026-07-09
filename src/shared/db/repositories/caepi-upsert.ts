/**
 * Escrita do job de ingestão CAEPI — handle Drizzle INJETADO (conexão
 * owner/unpooled do script ou o client admin do harness de integração).
 * NÃO importa `server-only` nem o singleton `db` de propósito: o script tsx
 * roda fora do ambiente React Server (o guard lançaria) e o papel `app_runtime`
 * não tem GRANT de escrita nesta tabela (a contenção da exceção de tenant).
 */
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { CaepiParsedRow } from "@/shared/integrations/caepi/types";

import { caepiCertificates } from "../schema/caepi-certificates";

function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}

const CHUNK_SIZE = 1_000;

/**
 * O Postgres rejeita afetar a mesma linha 2× num único INSERT … ON CONFLICT;
 * dentro do chunk vence a ÚLTIMA ocorrência do `ca` (data-model §2).
 */
function dedupeByCa(rows: CaepiParsedRow[]): CaepiParsedRow[] {
  const byCa = new Map<string, CaepiParsedRow>();
  for (const row of rows) byCa.set(row.ca, row);
  return [...byCa.values()];
}

/**
 * Upsert idempotente por `ca` em chunks (~1.000 linhas ≈ 11k parâmetros, folga
 * sob o limite do Postgres), SEM transação global: nunca há truncate/delete,
 * cada CA é atômico e a reexecução idempotente conserta carga parcial (R5).
 * Todas as linhas de uma execução recebem o mesmo `syncedAt`.
 */
export async function upsertMany(
  db: PostgresJsDatabase<Record<string, unknown>>,
  rows: CaepiParsedRow[],
  syncedAt: Date,
): Promise<{ upserted: number }> {
  const deduped = dedupeByCa(rows);
  let upserted = 0;

  for (let offset = 0; offset < deduped.length; offset += CHUNK_SIZE) {
    const chunk = deduped.slice(offset, offset + CHUNK_SIZE);
    await db
      .insert(caepiCertificates)
      .values(chunk.map((row) => ({ ...row, syncedAt })))
      .onConflictDoUpdate({
        target: caepiCertificates.ca,
        set: {
          validUntil: sqlExcluded("valid_until"),
          situation: sqlExcluded("situation"),
          manufacturerName: sqlExcluded("manufacturer_name"),
          manufacturerCnpj: sqlExcluded("manufacturer_cnpj"),
          equipmentName: sqlExcluded("equipment_name"),
          description: sqlExcluded("description"),
          nature: sqlExcluded("nature"),
          norms: sqlExcluded("norms"),
          syncedAt: sqlExcluded("synced_at"),
        },
      });
    upserted += chunk.length;
  }

  return { upserted };
}
