import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { healthExamInputSchema, EXAM_TYPES } from "@/shared/domains/pgr/health-exams";
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
  return restHandler(req, ({ tenantId }) =>
    repo.listHealthExams(tenantId, {
      ...pageParamsFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      examType: examTypeFrom(req),
    }),
  );
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
