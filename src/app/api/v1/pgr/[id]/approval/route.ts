import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  documentApprovalOverview,
  assignReviewer,
  approveDocument,
} from "@/shared/server/pgr/document-approval-core";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(req, (ctx) => documentApprovalOverview(ctx, id), {
    tenantAccess: true,
  });
}
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(
    req,
    async (ctx) => assignReviewer(ctx, id, await readJsonBody(req)),
    { status: 201 },
  );
}
export async function PUT(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(
    req,
    async (ctx) => approveDocument(ctx, id, await readJsonBody(req)),
    { status: 201, tenantAccess: true },
  );
}
