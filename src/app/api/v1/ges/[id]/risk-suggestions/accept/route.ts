import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runAcceptSuggestedRisks } from "@/shared/server/pgr/ai-risk-suggestion-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/ges/{id}/risk-suggestions/accept — persiste as sugestões
 * selecionadas como rascunhos em `risks`. 201 com `{ created }`.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id } = await params;
      return runAcceptSuggestedRisks(ctx, id, await req.json());
    },
    { status: 201 },
  );
}
