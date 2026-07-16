import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST — encerra formalmente a campanha (status = closed).
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const ok = await repo.concludeCampaign(tenantId, id);
    if (!ok) throw new NotFoundError();
    return { id };
  });
}
