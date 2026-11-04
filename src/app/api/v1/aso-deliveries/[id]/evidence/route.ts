import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { deliveryEvidenceDownload } from "@/shared/server/medicine/aso-delivery-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// URL assinada curta do comprovante de entrega: { url, expiresInSeconds, sha256 } (NOB-165).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    deliveryEvidenceDownload(ctx, (await context.params).id),
  );
}
