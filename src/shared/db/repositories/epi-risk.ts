import "server-only";

import { and, asc, eq, ilike, notInArray, or, type SQL } from "drizzle-orm";

import type {
  EpiOption,
  EpiRiskLinkItem,
  EpiRiskLinkValues,
} from "@/shared/domains/pgr/epi-risk";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { epiRisk, epiCatalog, type EpiRisk } from "../schema/epis";
import { risks } from "../schema/risks";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "pgr.epi_risk.write_rejected";

/**
 * O risco precisa existir no tenant ativo. A FK `risk_id → risks` é checada pelo
 * Postgres ignorando RLS, então este assert sob `withOrg` é a barreira real de
 * isolamento (risco de outro tenant / inexistente → FK_NOT_FOUND).
 */
async function assertRiskInTenant(
  tx: TenantTransaction,
  orgId: string,
  riskId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: risks.id })
    .from(risks)
    .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("risk");
}

/** Idem para o item do catálogo (FK `catalog_id → epi_catalog`). */
async function assertCatalogInTenant(
  tx: TenantTransaction,
  orgId: string,
  catalogId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: epiCatalog.id })
    .from(epiCatalog)
    .where(and(eq(epiCatalog.orgId, orgId), eq(epiCatalog.id, catalogId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("epi_catalog");
}

/** EPIs vinculados a um risco (Nome · CA · Neutraliza?), ordenados por nome. */
export async function listRiskEpis(
  orgId: string,
  params: { riskId: string },
): Promise<EpiRiskLinkItem[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: epiRisk.id,
        catalogId: epiRisk.catalogId,
        name: epiCatalog.name,
        ca: epiCatalog.ca,
        neutralization: epiRisk.neutralization,
      })
      .from(epiRisk)
      .innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
      .where(and(eq(epiRisk.orgId, orgId), eq(epiRisk.riskId, params.riskId)))
      .orderBy(asc(epiCatalog.name)),
  );
}

/**
 * EPIs do catálogo elegíveis para vincular ao risco: itens `type = 'epi'` do
 * tenant que ainda **não** estão vinculados a este risco, com busca por nome/CA.
 */
export async function listAvailableEpisForRisk(
  orgId: string,
  riskId: string,
  params: { search?: string } = {},
): Promise<EpiOption[]> {
  const search = params.search?.trim();
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const linked = tx
      .select({ catalogId: epiRisk.catalogId })
      .from(epiRisk)
      .where(and(eq(epiRisk.orgId, orgId), eq(epiRisk.riskId, riskId)));
    const filters: SQL[] = [
      eq(epiCatalog.orgId, orgId),
      eq(epiCatalog.type, "epi"),
      notInArray(epiCatalog.id, linked),
    ];
    if (search) {
      const term = `%${search}%`;
      filters.push(or(ilike(epiCatalog.name, term), ilike(epiCatalog.ca, term))!);
    }
    return tx
      .select({ catalogId: epiCatalog.id, name: epiCatalog.name, ca: epiCatalog.ca })
      .from(epiCatalog)
      .where(and(...filters))
      .orderBy(asc(epiCatalog.name));
  });
}

/** Cria o vínculo. Par (org, item, risco) duplicado → DUPLICATE (unique). */
export async function createRiskEpi(
  orgId: string,
  input: EpiRiskLinkValues,
): Promise<EpiRisk> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertRiskInTenant(tx, orgId, input.riskId);
      await assertCatalogInTenant(tx, orgId, input.catalogId);
      const [row] = await tx
        .insert(epiRisk)
        .values({
          orgId,
          riskId: input.riskId,
          catalogId: input.catalogId,
          neutralization: input.neutralization,
        })
        .returning();
      return row;
    }),
  );
}

export async function createRiskEpis(
  orgId: string,
  riskId: string,
  links: readonly Omit<EpiRiskLinkValues, "riskId">[],
): Promise<number> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertRiskInTenant(tx, orgId, riskId);
      const rows = await tx
        .insert(epiRisk)
        .values(
          links.map((link) => ({
            orgId,
            riskId,
            catalogId: link.catalogId,
            neutralization: link.neutralization,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: epiRisk.id });
      return rows.length;
    }),
  );
}

/** Atualiza só a indicação de neutralização de um vínculo. `null` ⇒ NOT_FOUND. */
export async function updateRiskEpiNeutralization(
  orgId: string,
  id: string,
  input: { neutralization: EpiRiskLinkValues["neutralization"] },
): Promise<EpiRisk | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(epiRisk)
        .set({ neutralization: input.neutralization, updatedAt: new Date() })
        .where(and(eq(epiRisk.orgId, orgId), eq(epiRisk.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

/** Remove (físico — D3) o vínculo. `false` ⇒ NOT_FOUND. */
export async function deleteRiskEpi(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(epiRisk)
        .where(and(eq(epiRisk.orgId, orgId), eq(epiRisk.id, id)))
        .returning({ id: epiRisk.id });
      return rows.length > 0;
    }),
  );
}
