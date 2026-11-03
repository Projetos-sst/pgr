import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { getAbsence, updateAbsenceEnd } from "@/shared/server/medicine/absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Afastamento com avaliação e histórico (administrativo; sem CID).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => getAbsence(ctx, (await context.params).id));
}

// Último dia previsto/conhecido de afastamento aberto: { endsOn: "AAAA-MM-DD" | null }.
export function PUT(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    updateAbsenceEnd(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
