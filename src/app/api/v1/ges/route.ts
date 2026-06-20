import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { gesInputSchema } from "@/shared/domains/pgr/ges";
import * as repo from "@/shared/db/repositories/ges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listGes(tenantId, {
      ...pageParamsFrom(req),
      companyId: sp.get("companyId") ?? undefined,
      workUnitId: sp.get("workUnitId") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = gesInputSchema.parse(await req.json());
      return repo.createGes(tenantId, input);
    },
    { status: 201 },
  );
}
