import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  riskAuthorizationWorkspace,
  appointCompanyAuthorizer,
} from "@/shared/server/medicine/risk-authorization-core";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) =>
      riskAuthorizationWorkspace(ctx, (await params).id, pageParamsFrom(req)),
    { tenantAccess: true },
  );
}
export function PUT(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) =>
      appointCompanyAuthorizer(ctx, (await params).id, await readJsonBody(req)),
    { tenantAccess: true },
  );
}
