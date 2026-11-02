import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  defineCriteria,
  listCriteria,
} from "@/shared/server/medicine/interpretation-criteria-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Exames do plano aprovado com o critério vigente de cada um (e os que faltam).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listCriteria(ctx, (await context.params).id));
}

// Nova versão ({ code, otherDescription?, criteria, conduct }); só o coordenador vinculado.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      defineCriteria(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
