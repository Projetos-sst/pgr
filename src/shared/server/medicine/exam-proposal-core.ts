import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  getProcedure,
  procedureSearchSchema,
  searchProcedures,
  PROCEDURE_CATALOG_SOURCE,
} from "@/shared/domains/medicine/procedure-catalog";
import {
  buildExamProposal,
  type ProposalSource,
} from "@/shared/domains/medicine/exam-proposal";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { PAGE_SIZE_MAX, type PageParams } from "@/shared/pagination";

import { getMedicalRiskInventory } from "./risk-source-core";

/** Catálogo é dado público e global; o gate de escritório vem de officeAction/restHandler. */
export function searchProcedureCatalog(input: unknown, page: PageParams = {}) {
  const { search } = procedureSearchSchema.parse(input ?? {});
  return { ...searchProcedures(search, page), source: PROCEDURE_CATALOG_SOURCE };
}

export function getCatalogProcedure(code: string) {
  const procedure = getProcedure(code.trim());
  if (!procedure) throw new NotFoundError();
  return { ...procedure, source: PROCEDURE_CATALOG_SOURCE };
}

/**
 * Proposta só leitura a partir de TODAS as fontes da empresa (a paginação do inventário
 * não pode esconder uma fonte vigente). Isolamento, empresa e módulo Medicina são
 * conferidos por `getMedicalRiskInventory` (withOrg + assertCompanyModuleTx + RLS).
 */
export async function getExamProposal(ctx: TenantContext, companyId: string) {
  const sources: ProposalSource[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getMedicalRiskInventory(ctx, companyId, {
      page,
      pageSize: PAGE_SIZE_MAX,
    });
    sources.push(
      ...result.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        version: row.version,
        reference: row.reference,
        freshness: row.freshness,
        superseded: row.superseded,
        risks: row.risks.map((risk) => ({
          id: risk.id,
          status: risk.status,
          content: risk.content,
        })),
      })),
    );
    if (sources.length >= result.total || result.rows.length === 0) break;
  }
  return buildExamProposal(sources);
}
