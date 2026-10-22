import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  healthExamInputSchema,
  healthExamListFiltersSchema,
  EXAM_TYPES,
} from "@/shared/domains/pgr/health-exams";
import type { ExamType } from "@/shared/domains/pgr/health-exams";
import * as repo from "@/shared/db/repositories/health-exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function examTypeFrom(req: NextRequest): ExamType | undefined {
  const value = req.nextUrl.searchParams.get("examType");
  return (EXAM_TYPES as readonly string[]).includes(value ?? "")
    ? (value as ExamType)
    : undefined;
}

export function GET(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    // ID malformado → 422 VALIDATION (nunca lista vazia); ID de outro tenant → lista
    // vazia (filtro somado a org_id). companyId = empresa ATUAL do funcionário.
    const filters = healthExamListFiltersSchema.parse({
      employeeId: sp.get("employeeId") ?? undefined,
      companyId: sp.get("companyId") ?? undefined,
    });
    return repo.listHealthExams(tenantId, {
      ...pageParamsFrom(req),
      search: sp.get("search") ?? undefined,
      examType: examTypeFrom(req),
      ...filters,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = healthExamInputSchema.parse(await req.json());
      return repo.createHealthExam(tenantId, input);
    },
    { status: 201 },
  );
}
