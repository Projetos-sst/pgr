import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  registerRestrictedReviewer,
  revokeRestrictedReviewer,
} from "@/shared/server/pgr/document-approval-core";
type Context = { params: Promise<{ id: string }> };
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(
    req,
    async (ctx) => registerRestrictedReviewer(ctx, id, await readJsonBody(req)),
    { status: 201 },
  );
}
export async function DELETE(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(req, async (ctx) =>
    revokeRestrictedReviewer(ctx, id, await readJsonBody(req)),
  );
}
