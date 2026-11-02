import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { addItem } from "@/shared/server/medicine/exam-plan-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => addItem(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
