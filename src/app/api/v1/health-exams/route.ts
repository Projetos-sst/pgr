import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  healthExamInputSchema,
  healthExamListFiltersSchema,
} from "@/shared/domains/pgr/health-exams";
import * as repo from "@/shared/db/repositories/health-exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    // ID malformado ou tipo fora do enum → 422 VALIDATION (nunca lista vazia nem
    // filtro ignorado); ID de outro tenant → lista vazia (filtro somado a org_id).
    // companyId = empresa ATUAL do funcionário.
    const filters = healthExamListFiltersSchema.parse({
      employeeId: sp.get("employeeId") ?? undefined,
      companyId: sp.get("companyId") ?? undefined,
      examType: sp.get("examType") ?? undefined,
    });
    return repo.listHealthExams(tenantId, {
      ...pageParamsFrom(req),
      search: sp.get("search") ?? undefined,
      ...filters,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = healthExamInputSchema.parse(await readJsonBody(req));
      return repo.createHealthExam(tenantId, input);
    },
    { status: 201 },
  );
}
