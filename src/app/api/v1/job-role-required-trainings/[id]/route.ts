import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/job-role-required-trainings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const removed = await repo.removeRequiredTraining(tenantId, id);
      if (!removed) throw new NotFoundError();
    },
    { status: 204 },
  );
}
