import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { recordReviewDecision } from "@/shared/server/pgr/document-review-core";
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sampleId: string }> },
) {
  return restHandler(
    req,
    async (ctx) => {
      const p = await params;
      return recordReviewDecision(ctx, p.id, p.sampleId, await readJsonBody(req));
    },
    { status: 201 },
  );
}
