import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  getMedicalRiskInventory,
  registerMedicalRiskSource,
} from "@/shared/server/medicine/risk-source-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    getMedicalRiskInventory(ctx, (await context.params).id, pageParamsFrom(req)),
  );
}
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      registerMedicalRiskSource(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
