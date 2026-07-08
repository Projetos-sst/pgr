import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { epiRiskLinkInputSchema } from "@/shared/domains/pgr/epi-risk";
import * as linkRepo from "@/shared/db/repositories/epi-risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    if (req.nextUrl.searchParams.get("available") === "true") {
      const search = req.nextUrl.searchParams.get("search") ?? undefined;
      return linkRepo.listAvailableEpisForRisk(tenantId, id, { search });
    }
    return linkRepo.listRiskEpis(tenantId, { riskId: id });
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const body = (await req.json()) as Record<string, unknown>;
      const input = epiRiskLinkInputSchema.parse({ ...body, riskId: id });
      return linkRepo.createRiskEpi(tenantId, input);
    },
    { status: 201 },
  );
}
