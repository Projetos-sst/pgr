import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import type { RiskAssessmentFillContext } from "@/shared/domains/pgr/ai-risk-assessment-fill";
import { isNr09EligibleAgent } from "@/shared/domains/pgr/nr09";

import { withOrg } from "../with-org";
import { riskAssessments, risks } from "../schema/risks";

export async function fetchRiskAssessmentFillContext(
  orgId: string,
  riskId: string,
): Promise<RiskAssessmentFillContext | null> {
  return withOrg(orgId, async (tx) => {
    const [risk] = await tx
      .select({
        agentType: risks.agentType,
        hazard: risks.hazard,
        description: risks.description,
        sources: risks.sources,
        propagation: risks.propagation,
        exposureTime: risks.exposureTime,
        possibleInjuries: risks.possibleInjuries,
        concentrationIntensity: risks.concentrationIntensity,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
      .limit(1);
    if (!risk) return null;

    const measured = await tx
      .select({ id: riskAssessments.id })
      .from(riskAssessments)
      .where(
        and(
          eq(riskAssessments.orgId, orgId),
          eq(riskAssessments.riskId, riskId),
          isNotNull(riskAssessments.measuredValue),
        ),
      )
      .limit(1);

    const { concentrationIntensity, ...fields } = risk;
    return {
      ...fields,
      hasMeasuredValue: concentrationIntensity !== null || measured.length > 0,
      nr09Eligible: isNr09EligibleAgent(risk.agentType),
    };
  });
}
