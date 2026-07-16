import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { campaignStatusSchema } from "@/shared/domains/psychosocial/campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// PUT { status } — transiciona o status da campanha (regras no repositório).
export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const body = (await req.json()) as { status?: unknown };
    const ok = await repo.setCampaignStatus(
      tenantId,
      id,
      campaignStatusSchema.parse(body.status),
    );
    if (!ok) throw new NotFoundError();
    return { id };
  });
}
