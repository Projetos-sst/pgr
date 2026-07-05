import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/epi-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    return repo.getDelivery(tenantId, id);
  });
}

// Sem PUT: entregas são imutáveis após a criação (YAGNI) — só as transições de
// assinatura (`/sign` e rota pública) e a devolução (`/return`) as tocam; é essa
// imutabilidade que faz do `updated_at` da assinatura um timestamp legal.
export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      await repo.deleteDelivery(tenantId, id);
    },
    { status: 204 },
  );
}
