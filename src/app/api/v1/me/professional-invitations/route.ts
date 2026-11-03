import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { myPendingInvitations } from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convites endereçados à conta da sessão que esperam o aceite dela (NOB-157).
export function GET(req: NextRequest) {
  return restHandler(req, async (ctx) => myPendingInvitations(ctx), {
    tenantAccess: true,
  });
}
