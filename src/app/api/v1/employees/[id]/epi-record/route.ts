import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { epiRecordQuerySchema } from "@/shared/domains/pgr/epi-record";
import { getEmployeeEpiRecord } from "@/shared/db/repositories/employee-epi-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ficha de EPI do funcionário (US5, read-only). Query:
 * `?status=pendente|devolvido|todos&from=&to=&page=&pageSize=`.
 */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    const query = epiRecordQuerySchema.parse({
      status: sp.get("status") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    });
    return getEmployeeEpiRecord(tenantId, id, query);
  });
}
