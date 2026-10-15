import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/vehicles";
import { vehicleInputSchema } from "@/shared/domains/inspections/vehicles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const { page, pageSize, search } = pageParamsFrom(req);
    const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
    return repo.listVehiclesPaginated(tenantId, { page, pageSize, search, companyId });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createVehicle(tenantId, vehicleInputSchema.parse(await req.json())),
    { status: 201 },
  );
}
