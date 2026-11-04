import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { registerReportEvent } from "@/shared/server/medicine/analytical-report-presentation-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// { kind: "finalized", note? } | { kind: "presented", ... } | { kind: "discussed", ... } (NOB-168).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      registerReportEvent(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
