import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getReportContext } from "@/shared/server/medicine/analytical-report-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Período sugerido, relatório anterior, enquadramento (7.6.6) e totais; ?periodStart=&periodEnd= opcionais.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => {
    const params = req.nextUrl.searchParams;
    const period =
      params.has("periodStart") || params.has("periodEnd")
        ? { periodStart: params.get("periodStart"), periodEnd: params.get("periodEnd") }
        : undefined;
    return getReportContext(ctx, (await context.params).id, period);
  });
}
