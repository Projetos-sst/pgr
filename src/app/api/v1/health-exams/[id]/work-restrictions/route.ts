import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  listWorkRestrictions,
  recordWorkRestriction,
} from "@/shared/server/medicine/clinical-record-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Comunicação de restrição ao trabalho (NOB-155): o RH lê, sem diagnóstico.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    listWorkRestrictions(ctx, (await context.params).id),
  );
}

// Só o examinador ou o coordenador vinculado: { kind: "restriction", restriction } | { kind: "withdrawal" }.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      recordWorkRestriction(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
