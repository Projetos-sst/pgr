import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/safety-inspections";
import { safetyInspectionHeaderSchema } from "@/shared/domains/inspections/safety-inspections";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listSafetyInspections(tenantId, {
      ...pageParamsFrom(req),
      status: sp.get("status") ?? undefined,
      category: sp.get("category") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const created = await repo.createSafetyInspection(
        tenantId,
        safetyInspectionHeaderSchema.parse(await req.json()),
      );
      if (!created) throw new ReferenceNotFoundError();
      return created;
    },
    { status: 201 },
  );
}
