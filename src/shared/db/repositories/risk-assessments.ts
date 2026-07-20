import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type {
  RiskAssessmentListItem,
  RiskAssessmentWriteValues,
  RiskClassification,
} from "@/shared/domains/pgr/risk-assessment";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { riskAssessments, risks, type RiskAssessment } from "../schema/risks";
import { auditedTenantWrite } from "./audited-write";

export type ListRiskAssessmentsParams = PageParams;

function toColumns(values: RiskAssessmentWriteValues) {
  return {
    criterion: values.criterion,
    probability: values.probability,
    severity: values.severity,
    riskLevel: values.riskLevel,
    uncertaintyDegree: values.uncertaintyDegree,
    toleranceLimit: values.toleranceLimit ?? null,
    result: values.result,
    assessedAt: values.assessedAt,
  };
}

/** Ordena o histórico: mais recente por data de avaliação, desempate por criação. */
const ORDER = [
  desc(riskAssessments.assessedAt),
  desc(riskAssessments.createdAt),
] as const;

/** Garante que o risco existe DENTRO do tenant (senão FK_NOT_FOUND). */
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

export async function listRiskAssessments(
  orgId: string,
  riskId: string,
  params: ListRiskAssessmentsParams = {},
): Promise<Paginated<RiskAssessmentListItem>> {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const where = and(
      eq(riskAssessments.orgId, orgId),
      eq(riskAssessments.riskId, riskId),
    );
    const rows = await tx
      .select({
        id: riskAssessments.id,
        criterion: riskAssessments.criterion,
        probability: riskAssessments.probability,
        severity: riskAssessments.severity,
        riskLevel: riskAssessments.riskLevel,
        uncertaintyDegree: riskAssessments.uncertaintyDegree,
        toleranceLimit: riskAssessments.toleranceLimit,
        result: riskAssessments.result,
        assessedAt: riskAssessments.assessedAt,
        createdAt: riskAssessments.createdAt,
      })
      .from(riskAssessments)
      .where(where)
      .orderBy(...ORDER)
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(riskAssessments)
      .where(where);
    return {
      rows: rows.map((r) => ({
        ...r,
        result: (r.result as RiskClassification | null) ?? null,
      })),
      total,
    };
  });
}

export async function getRiskAssessmentById(
  orgId: string,
  id: string,
): Promise<RiskAssessment | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(riskAssessments)
      .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function getCurrentRiskAssessment(
  orgId: string,
  riskId: string,
): Promise<RiskAssessment | null> {
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const [row] = await tx
      .select()
      .from(riskAssessments)
      .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.riskId, riskId)))
      .orderBy(...ORDER)
      .limit(1);
    return row ?? null;
  });
}

export async function createRiskAssessment(
  orgId: string,
  riskId: string,
  values: RiskAssessmentWriteValues,
): Promise<RiskAssessment> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertRiskInTenant(tx, orgId, riskId);
      const [row] = await tx
        .insert(riskAssessments)
        .values({ orgId, riskId, ...toColumns(values) })
        .returning();
      return row;
    }),
  );
}

export async function updateRiskAssessment(
  orgId: string,
  id: string,
  values: RiskAssessmentWriteValues,
): Promise<RiskAssessment | null> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(riskAssessments)
        .set({ ...toColumns(values), updatedAt: new Date() })
        .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteRiskAssessment(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(riskAssessments)
        .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.id, id)))
        .returning({ id: riskAssessments.id });
      return rows.length > 0;
    }),
  );
}
