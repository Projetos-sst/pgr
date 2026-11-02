import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { approve } from "@/shared/server/medicine/exam-plan-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Aprovação pela coordenadora vinculada (NOB-149); substitui o plano aprovado anterior.
export function POST(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    approve(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
