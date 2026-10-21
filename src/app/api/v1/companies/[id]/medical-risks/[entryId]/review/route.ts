import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { decideCompanyRisk } from "@/shared/server/medicine/risk-authorization-core";
type Context = { params: Promise<{ id: string; entryId: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, entryId } = await params;
      return decideCompanyRisk(ctx, id, entryId, await readJsonBody(req));
    },
    { tenantAccess: true, status: 201 },
  );
}
