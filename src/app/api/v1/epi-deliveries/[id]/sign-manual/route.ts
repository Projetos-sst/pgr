import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/epi-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Assina manual + baixa transacional. 200 { delivery, newBalances, lowStockWarnings }.
// Erros: 422 (INSUFFICIENT_STOCK), 404 (NOT_FOUND), 409 (ALREADY_SIGNED), 403.
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    return repo.signDeliveryManual(tenantId, id);
  });
}
