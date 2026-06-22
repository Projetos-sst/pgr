import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/work-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    return repo.countWorkUnitDependents(tenantId, id);
  });
}
