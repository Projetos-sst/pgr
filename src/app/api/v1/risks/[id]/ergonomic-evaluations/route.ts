import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { ergonomicEvaluationInputSchema } from "@/shared/domains/pgr/ergonomics";
import * as repo from "@/shared/db/repositories/ergonomic-evaluations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Histórico de avaliações ergonômicas (NR-17) do risco — mais recente primeiro. */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: riskId } = await params;
    return repo.listErgonomicEvaluations(tenantId, riskId, pageParamsFrom(req));
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: riskId } = await params;
      const values = ergonomicEvaluationInputSchema.parse(await req.json());
      return repo.createErgonomicEvaluation(tenantId, riskId, values);
    },
    { status: 201 },
  );
}
