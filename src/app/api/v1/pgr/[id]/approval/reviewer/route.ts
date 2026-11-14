import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { assignDocumentReviewer } from "@/shared/server/pgr/document-approval-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) =>
      assignDocumentReviewer(ctx, (await params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
