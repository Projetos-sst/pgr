import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runRiskAssessmentFill } from "@/shared/server/pgr/ai-risk-assessment-fill-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    return runRiskAssessmentFill(ctx, id);
  });
}
