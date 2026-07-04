import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { createDeliverySchema } from "@/shared/domains/pgr/epi-deliveries";
import * as repo from "@/shared/db/repositories/epi-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listDeliveries(tenantId, {
      ...pageParamsFrom(req),
      employeeId: req.nextUrl.searchParams.get("employeeId") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = createDeliverySchema.parse(await req.json());
      return repo.createDelivery(tenantId, input);
    },
    { status: 201 },
  );
}
