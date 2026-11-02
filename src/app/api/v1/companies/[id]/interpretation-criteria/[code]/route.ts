import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { criteriaHistory } from "@/shared/server/medicine/interpretation-criteria-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; code: string }> };

// Histórico (todas as versões) dos critérios de um procedimento.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => {
    const { id, code } = await context.params;
    return criteriaHistory(ctx, id, code);
  });
}
