import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getVehiclePhotoUrl } from "@/shared/server/inspections/vehicle-photo-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async ({ tenantId }) =>
    getVehiclePhotoUrl(tenantId, (await params).id),
  );
}
