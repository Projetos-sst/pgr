import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { registerRiskInPgrSchema } from "@/shared/domains/psychosocial/campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; riskId: string }> };

// POST { gesId } — registra o risco derivado no inventário/PGR (agente psicossocial).
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { riskId } = await params;
      const { gesId } = registerRiskInPgrSchema.parse(await req.json());
      const result = await repo.registerRiskInPgr(tenantId, riskId, gesId);
      if (!result) throw new NotFoundError();
      return result;
    },
    { status: 201 },
  );
}
