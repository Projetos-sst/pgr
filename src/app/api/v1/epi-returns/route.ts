import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { returnCreateSchema } from "@/shared/domains/pgr/epi-returns";
import * as repo from "@/shared/db/repositories/epi-returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista itens pendentes de devolução (filtros: search, employeeId). 200.
export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listPendingReturns(tenantId, {
      ...pageParamsFrom(req),
      employeeId: sp.get("employeeId") ?? undefined,
    });
  });
}

// Registra a devolução (repõe estoque + carimba returned_at). 200.
// Erros: 422 (VALIDATION), 404 (NOT_FOUND), 409 (ALREADY_RETURNED), 403.
export function POST(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const input = returnCreateSchema.parse(await req.json());
    return repo.recordReturn(tenantId, input);
  });
}
