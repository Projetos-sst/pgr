import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { createCommercialPortalSession } from "@/shared/server/commercial/portal-session-core";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) =>
    createCommercialPortalSession(ctx, (await params).id),
  );
}
