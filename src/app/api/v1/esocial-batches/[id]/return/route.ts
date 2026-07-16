import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/esocial-events";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST — consulta (simulada) o retorno do lote e atualiza status dos eventos.
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const result = await repo.queryBatchReturn(tenantId, id);
    if (!result) throw new NotFoundError();
    return result;
  });
}
