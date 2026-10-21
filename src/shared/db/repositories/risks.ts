import "server-only";

import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type { RiskValues, RiskListItem } from "@/shared/domains/pgr/risk";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { risks, type Risk } from "../schema/risks";
import { ges } from "../schema/ges";
import { auditedTenantWrite } from "./audited-write";
import { assertCompanyModuleTx } from "./company-modules";

export type ListRisksParams = PageParams & {
  companyId?: string;
  workUnitId?: string;
  gesId?: string;
  search?: string;
};

function toRiskColumns(input: RiskValues) {
  return {
    gesId: input.gesId,
    agentType: input.agentType,
    hazard: input.hazard ?? null,
    description: input.description,
    sources: input.sources ?? null,
    propagation: input.propagation ?? null,
    exposureTime: input.exposureTime ?? null,
    possibleInjuries: input.possibleInjuries ?? null,
    noxiousAgentCode: input.noxiousAgentCode ?? null,
    measurementUnit: input.measurementUnit ?? null,
    concentrationIntensity: input.concentrationIntensity ?? null,
  };
}

/** Garante que o GES existe DENTRO do tenant (senão FK_NOT_FOUND). */
async function assertGesInTenant(
  tx: TenantTransaction,
  orgId: string,
  input: RiskValues,
): Promise<void> {
  const [row] = await tx
    .select({ id: ges.id, companyId: ges.companyId })
    .from(ges)
    .where(
      and(
        eq(ges.orgId, orgId),
        eq(ges.id, input.gesId),
        input.companyId ? eq(ges.companyId, input.companyId) : undefined,
        input.workUnitId ? eq(ges.workUnitId, input.workUnitId) : undefined,
      ),
    )
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
  await assertCompanyModuleTx(tx, orgId, row.companyId, "pgr");
}

export async function listRisks(
  orgId: string,
  params: ListRisksParams = {},
): Promise<Paginated<RiskListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(risks.orgId, orgId)];
  if (params.gesId) filters.push(eq(risks.gesId, params.gesId));
  if (params.companyId) filters.push(eq(ges.companyId, params.companyId));
  if (params.workUnitId) filters.push(eq(ges.workUnitId, params.workUnitId));
  const search = params.search?.trim();
  if (search) filters.push(ilike(risks.description, `%${search}%`));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: risks.id,
        gesId: risks.gesId,
        gesName: ges.name,
        agentType: risks.agentType,
        description: risks.description,
        exposureTime: risks.exposureTime,
        measurementUnit: risks.measurementUnit,
      })
      .from(risks)
      .innerJoin(ges, and(eq(ges.id, risks.gesId), eq(ges.orgId, orgId)))
      .where(where)
      .orderBy(desc(risks.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(risks)
      .innerJoin(ges, and(eq(ges.id, risks.gesId), eq(ges.orgId, orgId)))
      .where(where);
    return { rows, total };
  });
}

export async function getRiskById(orgId: string, id: string): Promise<Risk | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createRisk(orgId: string, input: RiskValues): Promise<Risk> {
  return auditedTenantWrite(orgId, "risks.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, input);
      const [row] = await tx
        .insert(risks)
        .values({ orgId, ...toRiskColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateRisk(
  orgId: string,
  id: string,
  input: RiskValues,
): Promise<Risk | null> {
  return auditedTenantWrite(orgId, "risks.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, input);
      const [row] = await tx
        .update(risks)
        .set({ ...toRiskColumns(input), updatedAt: new Date() })
        .where(and(eq(risks.orgId, orgId), eq(risks.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteRisk(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "risks.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(risks)
        .where(and(eq(risks.orgId, orgId), eq(risks.id, id)))
        .returning({ id: risks.id });
      return rows.length > 0;
    }),
  );
}
