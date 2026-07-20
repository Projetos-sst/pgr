import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/vehicular-inspections";
import { vehicularInspectionHeaderSchema } from "@/shared/domains/inspections/vehicular-inspections";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listVehicularInspections(tenantId, {
      ...pageParamsFrom(req),
      status: sp.get("status") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const created = await repo.createVehicularInspection(
        tenantId,
        vehicularInspectionHeaderSchema.parse(await req.json()),
      );
      if (!created) throw new ReferenceNotFoundError();
      return created;
    },
    { status: 201 },
  );
}
