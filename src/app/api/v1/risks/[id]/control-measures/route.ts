import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { controlMeasureInputSchema } from "@/shared/domains/pgr/control-measure";
import * as repo from "@/shared/db/repositories/control-measures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: riskId } = await params;
    return repo.listControlMeasures(tenantId, riskId, pageParamsFrom(req));
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: riskId } = await params;
      const values = controlMeasureInputSchema.parse(await req.json());
      return repo.createControlMeasure(tenantId, riskId, values);
    },
    { status: 201 },
  );
}
