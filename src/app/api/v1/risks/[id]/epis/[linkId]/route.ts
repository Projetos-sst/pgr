import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { epiRiskLinkUpdateSchema } from "@/shared/domains/pgr/epi-risk";
import * as linkRepo from "@/shared/db/repositories/epi-risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { linkId } = await params;
    const input = epiRiskLinkUpdateSchema.parse(await req.json());
    const row = await linkRepo.updateRiskEpiNeutralization(tenantId, linkId, input);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { linkId } = await params;
      const deleted = await linkRepo.deleteRiskEpi(tenantId, linkId);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
