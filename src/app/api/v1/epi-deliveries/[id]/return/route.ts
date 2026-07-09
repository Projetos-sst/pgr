import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { returnSchema } from "@/shared/domains/pgr/epi-deliveries";
import * as repo from "@/shared/db/repositories/epi-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Devolução de item da entrega (US4). Body `{ itemId }`; one-shot —
 * já devolvido → `ALREADY_RETURNED` (409). Repõe o saldo (`employee_return`).
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { itemId } = returnSchema.parse(await req.json());
    return repo.returnDeliveryItem(tenantId, id, itemId);
  });
}
