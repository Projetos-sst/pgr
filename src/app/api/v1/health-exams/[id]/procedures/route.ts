import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { addProcedure, listProcedures } from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listProcedures(ctx, (await context.params).id));
}

// Registra um exame complementar realizado ({ code, otherDescription?, performedAt }).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => addProcedure(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
