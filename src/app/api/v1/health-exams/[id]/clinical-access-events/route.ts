import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { listClinicalAccessEvents } from "@/shared/server/medicine/clinical-record-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Trilha de acesso ao prontuário (NOB-155): só o owner; sem conteúdo clínico.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    listClinicalAccessEvents(ctx, (await context.params).id),
  );
}
