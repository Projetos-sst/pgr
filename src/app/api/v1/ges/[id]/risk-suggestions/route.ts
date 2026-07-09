import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runSuggestRisks } from "@/shared/server/pgr/ai-risk-suggestion-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/ges/{id}/risk-suggestions — gera sugestões de risco por IA para o
 * GES (não persiste). 200 com a lista. Isolamento/cota/erros do LLM no core.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    return runSuggestRisks(ctx, id);
  });
}
