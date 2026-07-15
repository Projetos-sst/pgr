import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/vehicles";
import { vehicleInputSchema } from "@/shared/domains/inspections/vehicles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listVehiclesPaginated(tenantId, pageParamsFrom(req)),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createVehicle(tenantId, vehicleInputSchema.parse(await req.json())),
    { status: 201 },
  );
}
