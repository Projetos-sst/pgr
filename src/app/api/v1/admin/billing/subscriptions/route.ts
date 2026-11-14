import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { requireMaster } from "@/shared/auth/require-master";
import { listAdminSubscriptions } from "@/shared/server/commercial/admin-subscriptions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(
    req,
    async () => {
      const operator = await requireMaster();
      return listAdminSubscriptions(
        operator,
        Object.fromEntries(req.nextUrl.searchParams),
      );
    },
    { tenantAccess: true },
  );
}
