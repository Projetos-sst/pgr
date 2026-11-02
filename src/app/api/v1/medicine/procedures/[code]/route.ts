import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getCatalogProcedure } from "@/shared/server/medicine/exam-proposal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async () => getCatalogProcedure((await context.params).code));
}
