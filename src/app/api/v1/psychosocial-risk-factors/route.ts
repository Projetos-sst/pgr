import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { psychosocialRiskFactorInputSchema } from "@/shared/domains/psychosocial/risk-factors";
import * as repo from "@/shared/db/repositories/psychosocial-risk-factors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listPsychosocialRiskFactors(tenantId, {
      ...pageParamsFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      level: req.nextUrl.searchParams.get("level") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = psychosocialRiskFactorInputSchema.parse(await req.json());
      return repo.createPsychosocialRiskFactor(tenantId, input);
    },
    { status: 201 },
  );
}
