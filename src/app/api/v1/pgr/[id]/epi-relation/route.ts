import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { derivePgrEpiRelation } from "@/shared/domains/pgr/epi-relation";
import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { todayInSaoPaulo } from "@/shared/dates";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Relação de EPIs do PGR (#48) — somente leitura e **derivada** do cadastro. Não há
 * POST/PUT/DELETE de propósito: a relação não é digitada nem persistida.
 */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const consolidated = await getPgrConsolidated(tenantId, id);
    if (!consolidated) throw new NotFoundError();
    return derivePgrEpiRelation(consolidated, { today: todayInSaoPaulo() });
  });
}
