import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { signedAsoDownload } from "@/shared/server/medicine/aso-signed-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// URL assinada curta do PDF do ASO assinado: { url, expiresInSeconds, sha256 } (NOB-163).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    signedAsoDownload(ctx, (await context.params).id),
  );
}
