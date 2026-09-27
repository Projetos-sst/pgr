"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  buildNr18Checklist,
  type Nr18ChecklistSummary,
} from "@/shared/domains/documents/nr18";
import {
  derivePgrEpiRelation,
  type PgrEpiRelationItem,
} from "@/shared/domains/pgr/epi-relation";
import { listPgrNr18Documents } from "@/shared/db/repositories/documents";
import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { getPgrById } from "@/shared/db/repositories/pgr";
import { todayInSaoPaulo } from "@/shared/dates";
import { NotFoundError } from "@/shared/errors/not-found-error";

/**
 * Checklist dos documentos complementares da NR-18 (#48). Leitura pura: nenhuma
 * escrita, nenhuma tabela nova — só agrupa por tipo os anexos que o GED já tem.
 * PGR de outro tenant → `NOT_FOUND` (o `withOrg` do repositório também não traria
 * documento algum).
 */
export async function getPgrNr18ChecklistAction(
  pgrId: string,
): Promise<ActionResult<Nr18ChecklistSummary>> {
  return officeAction("pgr.nr18.checklist", async ({ tenantId }) => {
    const pgr = await getPgrById(tenantId, pgrId);
    if (!pgr) throw new NotFoundError();
    const documents = await listPgrNr18Documents(tenantId, pgrId);
    return buildNr18Checklist(documents);
  });
}

/**
 * Relação de EPIs do PGR (#48) — leitura **derivada** da visão consolidada
 * (PGR → GES → riscos → `epi_risk` → `epi_catalog`), deduplicada por item. Não existe
 * escrita: para mudar qualquer dado, edita-se o catálogo de EPI.
 */
export async function getPgrEpiRelationAction(
  pgrId: string,
): Promise<ActionResult<PgrEpiRelationItem[]>> {
  return officeAction("pgr.epi_relation.list", async ({ tenantId }) => {
    const consolidated = await getPgrConsolidated(tenantId, pgrId);
    if (!consolidated) throw new NotFoundError();
    return derivePgrEpiRelation(consolidated, { today: todayInSaoPaulo() });
  });
}
