import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  addClinicalNote,
  readClinicalRecord,
} from "@/shared/server/medicine/clinical-record-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Prontuário do exame (NOB-155): só a conta vinculada ao examinador ou ao coordenador; leitura auditada.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    readClinicalRecord(ctx, (await context.params).id),
  );
}

// Nova observação clínica ({ content }), só inclusão, em nome do médico da conta vinculada.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      addClinicalNote(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
