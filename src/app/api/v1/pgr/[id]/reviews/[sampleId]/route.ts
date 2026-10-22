import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { getReviewSample } from "@/shared/server/pgr/document-review-core";
export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sampleId: string }> },
) {
  return restHandler(req, async (ctx) => {
    const p = await params;
    return getReviewSample(ctx, p.id, p.sampleId, pageParamsFrom(req));
  });
}
