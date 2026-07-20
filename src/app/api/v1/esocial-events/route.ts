import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/esocial-events";
import { buildEsocialXml } from "@/shared/domains/esocial/builders";
import { eventTypeSchema } from "@/shared/domains/esocial/events";
import type { EsocialEventType } from "@/shared/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listEvents(tenantId, {
      ...pageParamsFrom(req),
      status: (sp.get("status") ?? undefined) as never,
      eventType: (sp.get("eventType") ?? undefined) as never,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });
  });
}

// POST { type, input, referenceId? } — gera e persiste um evento (status pending).
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const body = (await req.json()) as {
        type?: unknown;
        input?: unknown;
        referenceId?: string;
      };
      const eventType = eventTypeSchema.parse(body.type) as EsocialEventType;
      const payload = buildEsocialXml(eventType, body.input);
      return repo.createEvent(tenantId, {
        eventType,
        payload,
        referenceId: body.referenceId ?? null,
      });
    },
    { status: 201 },
  );
}
