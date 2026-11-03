import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  addClinicalNote,
  readClinicalNotes,
} from "@/shared/server/medicine/absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Área clínica (atestado e CID): só o coordenador vinculado; leitura auditada.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    readClinicalNotes(ctx, (await context.params).id),
  );
}

// { content?, cid?, workerAuthorization? }: CID só com autorização do trabalhador registrada.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      addClinicalNote(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
