import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { pgrSignatureRequestSchema } from "@/shared/domains/pgr/pgr-signature";
import {
  createPgrSignature,
  getPgrSignatureView,
} from "@/shared/server/pgr/pgr-signature-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Assinatura do PGR (office staff). `POST` cria (201) — o payload é montado NO SERVIDOR; o body só
 * aceita `ttlSeconds?` (schema `.strict()` → qualquer outro campo é 422). `GET` devolve o estado
 * derivado (200) e NUNCA token/URL. Mesmo core da Server Action (regra vive uma vez).
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id: pgrId } = await params;
      const body = await req.json().catch(() => ({}));
      const opts = pgrSignatureRequestSchema.parse(body);
      return createPgrSignature(ctx, pgrId, opts);
    },
    { status: 201 },
  );
}

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id: pgrId } = await params;
    return getPgrSignatureView(ctx, pgrId);
  });
}
