import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { workUnitInputSchema } from "@/shared/domains/pgr/work-units";
import * as repo from "@/shared/db/repositories/work-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listWorkUnits(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = workUnitInputSchema.parse(await req.json());
      return repo.createWorkUnit(tenantId, input);
    },
    { status: 201 },
  );
}
