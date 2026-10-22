import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { authorizeCompanyProfessional } from "@/shared/server/medicine/risk-authorization-core";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function PUT(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) =>
      authorizeCompanyProfessional(ctx, (await params).id, await readJsonBody(req)),
    { tenantAccess: true },
  );
}
