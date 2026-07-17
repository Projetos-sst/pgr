import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  accidentCreateSchema,
  accidentFiltersSchema,
} from "@/shared/domains/safety/accident";
import * as repo from "@/shared/db/repositories/accidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const { page, pageSize, search } = pageParamsFrom(req);
    const sp = req.nextUrl.searchParams;
    const filters = accidentFiltersSchema.parse({
      page,
      pageSize,
      q: search,
      status: sp.get("status") ?? undefined,
      type: sp.get("type") ?? undefined,
      category: sp.get("category") ?? undefined,
      severity: sp.get("severity") ?? undefined,
      companyId: sp.get("company_id") ?? undefined,
      employeeId: sp.get("employee_id") ?? undefined,
      occurredFrom: sp.get("occurred_from") ?? undefined,
      occurredTo: sp.get("occurred_to") ?? undefined,
    });
    return repo.listAccidents(tenantId, filters);
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = accidentCreateSchema.parse(await req.json());
      return repo.createAccident(tenantId, input);
    },
    { status: 201 },
  );
}
