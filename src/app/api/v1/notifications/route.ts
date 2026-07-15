import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getNotifications } from "@/shared/server/platform/notifications-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => getNotifications(tenantId));
}
