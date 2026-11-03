import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { listLinks } from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Histórico de vínculos. Desde a NOB-157 não há vínculo direto: use /user-link-invitations.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listLinks(ctx, (await context.params).id));
}
