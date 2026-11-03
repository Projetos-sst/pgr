import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { createAbsence, listAbsences } from "@/shared/server/medicine/absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Afastamentos administrativos do funcionário (NOB-139), com a avaliação de retorno; sem CID.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listAbsences(ctx, (await context.params).id));
}

// { cause, workRelation?, startsOn, endsOn? }: empresa = vínculo atual do funcionário.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => createAbsence(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
