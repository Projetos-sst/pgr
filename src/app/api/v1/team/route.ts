import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import { listTeam } from "@/shared/server/platform/team-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => listTeam(ctx, pageParamsFrom(req)));
}
