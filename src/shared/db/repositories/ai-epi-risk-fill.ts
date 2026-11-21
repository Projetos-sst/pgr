import "server-only";

import { and, asc, eq, notInArray } from "drizzle-orm";

import {
  MAX_EPI_CATALOG_OPTIONS,
  type EpiRiskFillContext,
} from "@/shared/domains/pgr/ai-epi-risk-fill";

import { withOrg } from "../with-org";
import { epiCatalog, epiRisk } from "../schema/epis";
import { risks } from "../schema/risks";

export async function fetchEpiRiskFillContext(
  orgId: string,
  riskId: string,
): Promise<EpiRiskFillContext | null> {
  return withOrg(orgId, async (tx) => {
    const [risk] = await tx
      .select({
        agentType: risks.agentType,
        hazard: risks.hazard,
        description: risks.description,
        sources: risks.sources,
        propagation: risks.propagation,
        exposureTime: risks.exposureTime,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
      .limit(1);
    if (!risk) return null;

    const linked = await tx
      .select({ catalogId: epiRisk.catalogId })
      .from(epiRisk)
      .where(and(eq(epiRisk.orgId, orgId), eq(epiRisk.riskId, riskId)));
    const linkedCatalogIds = linked.map((l) => l.catalogId);

    const eligible = await tx
      .select({ catalogId: epiCatalog.id, name: epiCatalog.name, ca: epiCatalog.ca })
      .from(epiCatalog)
      .where(
        and(
          eq(epiCatalog.orgId, orgId),
          eq(epiCatalog.type, "epi"),
          notInArray(epiCatalog.id, linkedCatalogIds),
        ),
      )
      .orderBy(asc(epiCatalog.name), asc(epiCatalog.id))
      .limit(MAX_EPI_CATALOG_OPTIONS + 1);

    return {
      ...risk,
      catalog: eligible.slice(0, MAX_EPI_CATALOG_OPTIONS),
      truncated: eligible.length > MAX_EPI_CATALOG_OPTIONS,
      linkedCatalogIds,
    };
  });
}
