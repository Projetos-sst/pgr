import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runSuggestServiceOrderInstructions } from "@/shared/server/safety/ai-service-order-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/service-orders/{id}/instruction-suggestions — redige por IA as instruções
 * de segurança da OS (não persiste). 200 com a lista.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    return runSuggestServiceOrderInstructions(ctx, id);
  });
}
