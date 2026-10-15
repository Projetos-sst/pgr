import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { uploadVehiclePhoto } from "@/shared/server/inspections/vehicle-photo-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => uploadVehiclePhoto(tenantId, await req.formData()),
    { status: 201 },
  );
}
