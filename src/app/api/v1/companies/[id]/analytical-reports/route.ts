import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  generateReport,
  listReports,
} from "@/shared/server/medicine/analytical-report-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listReports(ctx, (await context.params).id));
}

// Elaboração pelo coordenador vinculado ({ periodStart, periodEnd, simplified?, variationDiscussion?, insufficiencyNote? }).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      generateReport(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
