import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getPlan } from "@/shared/server/medicine/exam-plan-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Sem PUT/DELETE no plano: muda por itens (rascunho) e por aprovação; aprovado não muda.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => getPlan(ctx, (await context.params).id));
}
