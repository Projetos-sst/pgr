import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { signedPcmsoDownload } from "@/shared/server/medicine/pcmso-signed-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// URL assinada curta do PDF do PCMSO assinado: { url, expiresInSeconds, sha256 } (NOB-166).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    signedPcmsoDownload(ctx, (await context.params).id),
  );
}
