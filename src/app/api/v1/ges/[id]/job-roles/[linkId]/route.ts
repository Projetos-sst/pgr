import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { gesJobRoleUpdateSchema } from "@/shared/domains/pgr/ges";
import * as linkRepo from "@/shared/db/repositories/ges-job-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { linkId } = await params;
    const input = gesJobRoleUpdateSchema.parse(await req.json());
    const row = await linkRepo.updateGesJobRole(tenantId, linkId, input);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { linkId } = await params;
      const deleted = await linkRepo.deleteGesJobRole(tenantId, linkId);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
