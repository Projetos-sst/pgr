import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runSuggestControlMeasures } from "@/shared/server/pgr/ai-control-measure-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/risks/{id}/control-measure-suggestions — propõe medidas de controle por IA
 * para o risco (não persiste). 200 com a lista. Isolamento/cota/erros do LLM no core.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    return runSuggestControlMeasures(ctx, id);
  });
}
