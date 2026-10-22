import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getMedicineOverview } from "@/shared/server/medicine/overview-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-model (só GET), precedente de /api/v1/dashboard/summary.
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getMedicineOverview(ctx));
}
