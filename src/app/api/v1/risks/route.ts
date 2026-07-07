import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { riskInputSchema } from "@/shared/domains/pgr/risk";
import * as repo from "@/shared/db/repositories/risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listRisks(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
      workUnitId: req.nextUrl.searchParams.get("workUnitId") ?? undefined,
      gesId: req.nextUrl.searchParams.get("gesId") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(await req.json());
      return repo.createRisk(tenantId, values);
    },
    { status: 201 },
  );
}
