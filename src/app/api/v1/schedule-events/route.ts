import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/schedule-events";
import { scheduleEventInputSchema } from "@/shared/domains/platform/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listScheduleEvents(tenantId, {
      ...pageParamsFrom(req),
      eventType: sp.get("eventType") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createScheduleEvent(
        tenantId,
        scheduleEventInputSchema.parse(await req.json()),
      ),
    { status: 201 },
  );
}
