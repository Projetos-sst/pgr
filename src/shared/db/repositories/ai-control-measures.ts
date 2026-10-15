import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { RiskControlContext } from "@/shared/domains/pgr/ai-control-measure-suggestion";
import type { ControlLevel } from "@/shared/domains/pgr/risks";
import type { RiskClassification } from "@/shared/domains/pgr/methodology";

import { withOrg } from "../with-org";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { jobRoles } from "../schema/job-roles";
import { controlMeasures, riskAssessments, risks } from "../schema/risks";

/**
 * Contexto **não-PII** de um risco para alimentar o prompt de medidas de controle: o
 * risco, o ambiente do GES, os **títulos** das funções expostas, a classificação vigente e
 * os níveis de controle já cadastrados. Escopado por `withOrg`; risco de outra org é
 * invisível pela RLS → retorna `null` (barreira de isolamento antes de qualquer chamada ao
 * LLM). Nunca lê `employees`.
 */
export async function fetchRiskControlContext(
  orgId: string,
  riskId: string,
): Promise<RiskControlContext | null> {
  return withOrg(orgId, async (tx) => {
    const [risk] = await tx
      .select({
        agentType: risks.agentType,
        hazard: risks.hazard,
        description: risks.description,
        sources: risks.sources,
        possibleInjuries: risks.possibleInjuries,
        gesId: risks.gesId,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
      .limit(1);
    if (!risk) return null;

    const [gesRow] = await tx
      .select({
        name: ges.name,
        processDescription: ges.processDescription,
        constructionType: ges.constructionType,
        lighting: ges.lighting,
        ventilation: ges.ventilation,
        otherCharacteristics: ges.otherCharacteristics,
      })
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.id, risk.gesId)))
      .limit(1);

    const roleRows = await tx
      .select({ title: jobRoles.title })
      .from(gesJobRoles)
      .innerJoin(
        jobRoles,
        and(eq(jobRoles.id, gesJobRoles.jobRoleId), eq(jobRoles.orgId, orgId)),
      )
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, risk.gesId)));

    // Classificação vigente = avaliação mais recente do risco (snapshot da época).
    const [assessment] = await tx
      .select({ result: riskAssessments.result, riskLevel: riskAssessments.riskLevel })
      .from(riskAssessments)
      .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.riskId, riskId)))
      .orderBy(desc(riskAssessments.assessedAt), desc(riskAssessments.createdAt))
      .limit(1);

    const levelRows = await tx
      .select({ controlLevel: controlMeasures.controlLevel })
      .from(controlMeasures)
      .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.riskId, riskId)));

    // O ambiente do GES vira uma linha só: o prompt não ganha nada com seis campos soltos.
    const environment = [
      gesRow?.constructionType,
      gesRow?.lighting,
      gesRow?.ventilation,
      gesRow?.otherCharacteristics,
    ]
      .filter((v): v is string => !!v && v.trim() !== "")
      .join("; ");

    return {
      agentType: risk.agentType,
      hazard: risk.hazard,
      description: risk.description,
      sources: risk.sources,
      possibleInjuries: risk.possibleInjuries,
      gesName: gesRow?.name ?? null,
      processDescription: gesRow?.processDescription ?? null,
      environment: environment === "" ? null : environment,
      roleTitles: roleRows.map((r) => r.title),
      classification: (assessment?.result as RiskClassification | undefined) ?? null,
      riskLevel: assessment?.riskLevel ?? null,
      existingLevels: levelRows.map((r) => r.controlLevel as ControlLevel),
    };
  });
}
