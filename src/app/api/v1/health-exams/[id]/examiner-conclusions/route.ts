import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  confirmExaminerConclusion,
  listExaminerConclusions,
} from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    listExaminerConclusions(ctx, (await context.params).id),
  );
}

// O examinador (conta vinculada) confirma apto ou inapto ({ conclusion }) para "apto com restrição".
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      confirmExaminerConclusion(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
