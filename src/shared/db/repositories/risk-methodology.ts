import "server-only";

import { eq } from "drizzle-orm";

import type {
  RiskMethodologyValues,
  RiskMethodologyView,
} from "@/shared/domains/pgr/methodology";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";

import { withOrg } from "../with-org";
import { riskMethodology, type RiskMethodology } from "../schema";
import { auditedTenantWrite } from "./audited-write";

function toColumns(input: RiskMethodologyValues) {
  return {
    base: input.base,
    probabilityGrades: input.probabilityGrades,
    severityGrades: input.severityGrades,
    classificationBands: input.classificationBands,
  };
}

export async function getRiskMethodology(orgId: string): Promise<RiskMethodology | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(riskMethodology)
      .where(eq(riskMethodology.orgId, orgId))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Metodologia da organização **ou** o padrão derivado (`configured: false`) quando
 * nenhuma foi salva — a leitura sempre devolve uma metodologia usável. O padrão
 * **não** é persistido (evita linha "fantasma"); grava só no salvar de fato.
 */
export async function getRiskMethodologyView(
  orgId: string,
): Promise<RiskMethodologyView> {
  const row = await getRiskMethodology(orgId);
  if (!row) return { configured: false, ...defaultRiskMethodology() };
  return {
    configured: true,
    base: row.base,
    probabilityGrades: row.probabilityGrades,
    severityGrades: row.severityGrades,
    classificationBands: row.classificationBands,
  };
}

/** Upsert do singleton por `org_id` (uma metodologia por organização). */
export async function upsertRiskMethodology(
  orgId: string,
  input: RiskMethodologyValues,
): Promise<RiskMethodology> {
  return auditedTenantWrite(orgId, "pgr.risk_methodology.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(riskMethodology)
        .values({ orgId, ...toColumns(input) })
        .onConflictDoUpdate({
          target: riskMethodology.orgId,
          set: { ...toColumns(input), updatedAt: new Date() },
        })
        .returning();
      return row;
    }),
  );
}
