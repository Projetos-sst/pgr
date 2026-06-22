import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { jobRoleInputSchema } from "@/shared/domains/pgr/job-roles";
import * as repo from "@/shared/db/repositories/job-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getJobRoleById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const input = jobRoleInputSchema.parse(await req.json());
    const row = await repo.updateJobRole(tenantId, id, input);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteJobRole(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
