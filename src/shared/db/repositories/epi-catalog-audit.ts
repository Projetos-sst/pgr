import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { withOrg, type TenantTransaction } from "../with-org";
import { epiCatalogAuditLog, type EpiCatalogAuditLog } from "../schema/epis";

export type { EpiCatalogAuditLog } from "../schema/epis";

export type RecordEpiCatalogAuditParams = {
  orgId: string;
  epiCatalogId: string;
  changedBy: string | null;
  summary: string;
};

/**
 * Insere uma linha de auditoria (append-only, issue #25) na MESMA transação
 * do write que a originou — recebe `tx` já aberto por `withOrg` em vez de
 * abrir a sua própria, para que o registro de histórico seja atômico com o
 * create/update de `epi_catalog` (ver `repositories/epi-catalog.ts`).
 */
export async function recordEpiCatalogAudit(
  tx: TenantTransaction,
  params: RecordEpiCatalogAuditParams,
): Promise<void> {
  await tx.insert(epiCatalogAuditLog).values({
    orgId: params.orgId,
    epiCatalogId: params.epiCatalogId,
    changedBy: params.changedBy,
    summary: params.summary,
  });
}

/**
 * Histórico de alterações de um item, mais recente primeiro. Lista simples
 * (sem paginação `{rows,total}`) — histórico de um único item costuma ser
 * curto; paginação seria complexidade sem benefício real aqui.
 */
export async function listEpiCatalogAudit(
  orgId: string,
  epiCatalogId: string,
): Promise<EpiCatalogAuditLog[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select()
      .from(epiCatalogAuditLog)
      .where(
        and(
          eq(epiCatalogAuditLog.orgId, orgId),
          eq(epiCatalogAuditLog.epiCatalogId, epiCatalogId),
        ),
      )
      .orderBy(desc(epiCatalogAuditLog.changedAt)),
  );
}
