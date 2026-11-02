import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { createDraft, listPlans } from "@/shared/server/medicine/exam-plan-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listPlans(ctx, (await context.params).id));
}

// Cria o rascunho a partir da proposta atual (sem corpo); um rascunho aberto por empresa.
export function POST(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => createDraft(ctx, (await context.params).id), {
    status: 201,
  });
}
