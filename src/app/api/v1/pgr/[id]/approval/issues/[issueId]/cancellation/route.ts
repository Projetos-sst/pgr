import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { cancelFinalIssue } from "@/shared/server/pgr/document-approval-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; issueId: string }> };

export function POST(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, issueId } = await params;
      return cancelFinalIssue(ctx, id, issueId, await readJsonBody(req));
    },
    { status: 201 },
  );
}
