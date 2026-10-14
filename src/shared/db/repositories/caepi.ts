import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "../index";
import { caepiCertificates, type CaepiCertificate } from "../schema";

export type { CaepiCertificate };

export type GetByCaResult =
  { record: CaepiCertificate } | { record: null; baseEmpty: boolean };

/**
 * SELECT por PK na tabela GLOBAL `caepi_certificates` — SEM `withOrg` de
 * propósito: dado público do MTE, idêntico para todos os tenants (exceção
 * documentada ao Princípio I; a contenção é o GRANT SELECT-only do papel
 * `app_runtime`). `ca` já chega normalizado (só dígitos) pela surface.
 *
 * Quando não encontra, informa se a tabela está vazia para a surface distinguir
 * "CA não existe" de "base CAEPI nunca sincronizada" sem segunda ida ao banco.
 */
export async function getByCa(ca: string): Promise<GetByCaResult> {
  const rows = await db
    .select()
    .from(caepiCertificates)
    .where(eq(caepiCertificates.ca, ca))
    .limit(1);

  if (rows.length > 0) return { record: rows[0] };

  const anyRow = await db
    .select({ one: sql<number>`1` })
    .from(caepiCertificates)
    .limit(1);
  return { record: null, baseEmpty: anyRow.length === 0 };
}
