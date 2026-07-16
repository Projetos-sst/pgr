import "server-only";

import { and, eq } from "drizzle-orm";

import { withOrg } from "../with-org";
import { pgr } from "../schema/pgr";
import { companies } from "../schema/companies";
import { workUnits } from "../schema/work-units";

/** Fonte mínima do PGR para montar o payload público de assinatura (fatia 022). */
export type PgrSignatureSource = {
  companyName: string;
  workUnitName: string | null;
  responsible: string | null;
  issuedAt: string | null; // date → 'AAAA-MM-DD'
  validUntil: string | null;
};

/**
 * Lê APENAS o cabeçalho do PGR + empresa + obra (nunca `employees`, GES, riscos, medidas ou
 * EPIs). `null` ⇒ PGR inexistente/cross-tenant → `NotFoundError` na camada de core/Action.
 * Tenant vem do `withOrg` (RLS backstop), jamais do cliente.
 */
export async function getPgrSignatureSource(
  orgId: string,
  pgrId: string,
): Promise<PgrSignatureSource | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        companyName: companies.razaoSocial,
        workUnitName: workUnits.name,
        responsible: pgr.responsible,
        issuedAt: pgr.issuedAt,
        validUntil: pgr.validUntil,
      })
      .from(pgr)
      .innerJoin(
        companies,
        and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)),
      )
      .leftJoin(
        workUnits,
        and(eq(workUnits.id, pgr.workUnitId), eq(workUnits.orgId, orgId)),
      )
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
      .limit(1);
    if (!row) return null;
    return {
      companyName: row.companyName,
      workUnitName: row.workUnitName ?? null,
      responsible: row.responsible,
      issuedAt: row.issuedAt,
      validUntil: row.validUntil,
    };
  });
}
