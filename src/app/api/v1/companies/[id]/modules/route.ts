import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  changeCompanyModule,
  getCompanyModuleOverview,
} from "@/shared/server/platform/company-module-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    getCompanyModuleOverview(ctx, (await context.params).id, pageParamsFrom(req)),
  );
}

export function PUT(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    changeCompanyModule(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
