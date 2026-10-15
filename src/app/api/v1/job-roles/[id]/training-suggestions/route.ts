import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runSuggestRequiredTrainings } from "@/shared/server/pgr/ai-required-training-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/job-roles/{id}/training-suggestions — propõe por IA os treinamentos
 * obrigatórios da função (não persiste). 200 com a lista já casada com o catálogo.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    return runSuggestRequiredTrainings(ctx, id);
  });
}
