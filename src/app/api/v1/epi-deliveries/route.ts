import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { deliveryCreateSchema } from "@/shared/domains/pgr/epi-deliveries";
import * as repo from "@/shared/db/repositories/epi-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cria a entrega PENDENTE (sem baixa). 201 { deliveryId, authToken }.
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = deliveryCreateSchema.parse(await req.json());
      return repo.createDelivery(tenantId, input);
    },
    { status: 201 },
  );
}
