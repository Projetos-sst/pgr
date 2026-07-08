"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  methodologyInputSchema,
  type RiskMethodologyInput,
  type RiskMethodologyView,
} from "@/shared/domains/pgr/methodology";
import * as repo from "@/shared/db/repositories/risk-methodology";
import type { RiskMethodology } from "@/shared/db/schema";

const BASE_PATH = "/risk-methodology";

export async function getRiskMethodologyAction(): Promise<
  ActionResult<RiskMethodologyView>
> {
  return officeAction("pgr.risk_methodology.get", ({ tenantId }) =>
    repo.getRiskMethodologyView(tenantId),
  );
}

export async function saveRiskMethodologyAction(
  input: RiskMethodologyInput,
): Promise<ActionResult<RiskMethodology>> {
  return officeAction(
    "pgr.risk_methodology.save",
    async ({ tenantId }) => {
      const data = methodologyInputSchema.parse(input);
      const saved = await repo.upsertRiskMethodology(tenantId, data);
      revalidatePath(BASE_PATH);
      return saved;
    },
    { audit: true },
  );
}
