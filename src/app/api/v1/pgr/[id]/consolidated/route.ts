import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    const data = await getPgrConsolidated(tenantId, pgrId);
    if (!data) throw new NotFoundError();
    return data;
  });
}
