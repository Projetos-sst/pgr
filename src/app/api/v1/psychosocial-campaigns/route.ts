import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { campaignInputSchema } from "@/shared/domains/psychosocial/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listCampaigns(tenantId, {
      ...pageParamsFrom(req),
      workUnitId: sp.get("workUnitId") ?? undefined,
      status: sp.get("status") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createCampaign(tenantId, campaignInputSchema.parse(await req.json())),
    { status: 201 },
  );
}
