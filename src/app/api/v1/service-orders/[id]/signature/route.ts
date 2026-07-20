import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { serviceOrderSignatureRequestSchema } from "@/shared/domains/safety/service-order-signature";
import {
  createServiceOrderSignature,
  getServiceOrderSignatureView,
} from "@/shared/server/safety/service-order-signature-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Assinatura da OS (office staff). `POST` cria (201) — o payload é montado NO SERVIDOR; o body só
 * aceita `ttlSeconds?` (schema `.strict()` → qualquer outro campo é 422) e a resposta traz o link/QR
 * **uma única vez**. `GET` devolve o estado derivado (200) e NUNCA token/hash/URL. Mesmo core da
 * Server Action (regra vive uma vez). Não existe REST público de assinatura: a captura roda pela
 * página `/signature-requests/[token]`.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id: serviceOrderId } = await params;
      const body = await req.json().catch(() => ({}));
      const opts = serviceOrderSignatureRequestSchema.parse(body);
      return createServiceOrderSignature(ctx, serviceOrderId, opts);
    },
    { status: 201 },
  );
}

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id: serviceOrderId } = await params;
    return getServiceOrderSignatureView(ctx, serviceOrderId);
  });
}
