import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getAsoReadiness } from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Conferência do conteúdo mínimo do ASO (NR-7 7.5.19.1 a–g); só leitura.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => getAsoReadiness(ctx, (await context.params).id));
}
