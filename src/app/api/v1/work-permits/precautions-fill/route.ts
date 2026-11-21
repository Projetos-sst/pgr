import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runWorkPermitPrecautionsFill } from "@/shared/server/work-permits/ai-precautions-fill-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) =>
    runWorkPermitPrecautionsFill(ctx, await req.json()),
  );
}
