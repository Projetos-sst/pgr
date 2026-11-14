import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { simulateRetention } from "@/shared/server/retention/retention-core";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    simulateRetention(ctx, Object.fromEntries(req.nextUrl.searchParams)),
  );
}
