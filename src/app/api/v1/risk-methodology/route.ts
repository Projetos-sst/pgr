import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { methodologyInputSchema } from "@/shared/domains/pgr/methodology";
import * as repo from "@/shared/db/repositories/risk-methodology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recurso **singleton** (uma metodologia por organização): sem `list`, sem `[id]`.
 * `GET` devolve a metodologia ativa (ou o padrão derivado); `PUT` faz upsert.
 */
export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => repo.getRiskMethodologyView(tenantId));
}

export function PUT(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const input = methodologyInputSchema.parse(await req.json());
    return repo.upsertRiskMethodology(tenantId, input);
  });
}
