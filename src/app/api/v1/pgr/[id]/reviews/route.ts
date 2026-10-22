import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  listReviewSamples,
  createReviewSample,
} from "@/shared/server/pgr/document-review-core";
type Context = { params: Promise<{ id: string }> };
export function GET(req: NextRequest, { params }: Context) {
  return restHandler(req, async (ctx) =>
    listReviewSamples(ctx, (await params).id, pageParamsFrom(req)),
  );
}
export function POST(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const row = await createReviewSample(
        ctx,
        (await params).id,
        await readJsonBody(req),
      );
      return { id: row.id, documentId: row.documentId };
    },
    { status: 201 },
  );
}
