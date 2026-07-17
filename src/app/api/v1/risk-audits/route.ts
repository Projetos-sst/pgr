import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  riskAuditCreateSchema,
  riskAuditFiltersSchema,
} from "@/shared/domains/safety/risk-audit";
import * as repo from "@/shared/db/repositories/risk-audits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const { page, pageSize } = pageParamsFrom(req);
    const sp = req.nextUrl.searchParams;
    const filters = riskAuditFiltersSchema.parse({
      page,
      pageSize,
      status: sp.get("status") ?? undefined,
      originType: sp.get("origin_type") ?? undefined,
      originId: sp.get("origin_id") ?? undefined,
    });
    return repo.listRiskAudits(tenantId, filters);
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = riskAuditCreateSchema.parse(await req.json());
      return repo.createRiskAudit(tenantId, input);
    },
    { status: 201 },
  );
}
