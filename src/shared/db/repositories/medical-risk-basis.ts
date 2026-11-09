import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type {
  RiskBasisRisk,
  RiskBasisSource,
} from "@/shared/domains/medicine/pcmso-signed";
import { canUseMedicalRisk } from "@/shared/domains/medicine/risk-sources";
import { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";

import type { TenantTransaction } from "../with-org";
import { medicalRiskEntries, medicalRiskSources } from "../schema/medical-risk-sources";
import { getInternalMedicalSources } from "./medical-risk-sources";

/**
 * Base de riscos vigente da empresa, lida na transação do chamador (NR-7 7.5.1, 7.5.5; SEG-21):
 * - `sources`: fontes não substituídas, com a versão;
 * - `fresh`: toda fonte interna ainda confere com o PGR de origem (impressão digital recalculada);
 * - `risks`/`riskIds`: riscos utilizáveis = validados em fonte conferível (`canUseMedicalRisk`),
 *   o mesmo conjunto que a proposta de exames e a prévia usam; ids ordenados, sem repetição.
 * Quem precisa de consistência com gravações concorrentes toma antes `lockMedicalRiskBasisTx`.
 */
export type LiveMedicalRiskBasis = {
  sources: RiskBasisSource[];
  fresh: boolean;
  risks: RiskBasisRisk[];
  riskIds: string[];
};

export async function liveMedicalRiskBasisTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<LiveMedicalRiskBasis> {
  const all = await tx
    .select()
    .from(medicalRiskSources)
    .where(
      and(
        eq(medicalRiskSources.orgId, orgId),
        eq(medicalRiskSources.companyId, companyId),
      ),
    );
  const superseded = new Set(all.map((row) => row.supersedesSourceId).filter(Boolean));
  const live = all.filter((row) => !superseded.has(row.id));
  const entries = live.length
    ? await tx
        .select()
        .from(medicalRiskEntries)
        .where(
          and(
            eq(medicalRiskEntries.orgId, orgId),
            eq(medicalRiskEntries.companyId, companyId),
            inArray(
              medicalRiskEntries.sourceId,
              live.map((row) => row.id),
            ),
          ),
        )
    : [];
  const internal = live.filter((row) => row.originPgrId);
  const current = await getInternalMedicalSources(
    orgId,
    companyId,
    internal.map((row) => row.originPgrId!),
    tx,
  );
  const fresh = new Set(
    internal
      .filter((row) => {
        const pgr = current.find((c) => c.pgrId === row.originPgrId);
        return pgr && medicalSourceFingerprint(pgr) === row.fingerprint;
      })
      .map((row) => row.id),
  );
  const freshness = (row: (typeof live)[number]) =>
    row.kind === "external"
      ? ("external_reference" as const)
      : fresh.has(row.id)
        ? ("current" as const)
        : ("changed" as const);
  const usable = live.flatMap((row) =>
    entries.filter(
      (e) => e.sourceId === row.id && canUseMedicalRisk(e.status, freshness(row)),
    ),
  );
  return {
    sources: live.map((row) => ({ id: row.id, version: row.version })),
    fresh: internal.every((row) => fresh.has(row.id)),
    risks: usable.map((e) => ({
      exposureGroup: e.content.exposureGroup,
      jobRole: e.content.jobRole?.trim() ?? "",
      description: e.content.description,
      agentType: e.content.agentType,
      possibleInjuries: e.content.possibleInjuries?.trim() || null,
    })),
    riskIds: [...new Set(usable.map((e) => e.id))].sort(),
  };
}
