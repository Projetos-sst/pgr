import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/training-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const item = await repo.getTrainingCatalogById(tenantId, id);
    if (!item) throw new NotFoundError();
    return repo.countTrainingCatalogDependents(tenantId, id);
  });
}
