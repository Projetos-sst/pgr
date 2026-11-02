import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getExamProposal } from "@/shared/server/medicine/exam-proposal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Read-model só GET: proposta assistiva, nada é persistido nem aprovado.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => getExamProposal(ctx, (await context.params).id));
}
