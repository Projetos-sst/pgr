import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getPcmsoReadiness } from "@/shared/server/medicine/pcmso-readiness-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Read-model só GET: conferência do PCMSO, sem gerar, aprovar ou assinar.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    getPcmsoReadiness(ctx, (await context.params).id),
  );
}
