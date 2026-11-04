import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { listReportPresentation } from "@/shared/server/medicine/analytical-report-presentation-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Eventos do relatório analítico, versão vigente e situação da apresentação (NOB-168).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    listReportPresentation(ctx, (await context.params).id),
  );
}
