import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  epiStockCreateSchema,
  epiStockStatusSchema,
  type EpiStockListFilters,
} from "@/shared/domains/pgr/epi-stock";
import * as repo from "@/shared/db/repositories/epi-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filtersFrom(req: NextRequest): EpiStockListFilters {
  const sp = req.nextUrl.searchParams;
  const status = epiStockStatusSchema.safeParse(sp.get("status"));
  return {
    search: sp.get("search") ?? undefined,
    withBalanceOnly: sp.get("withBalanceOnly") === "true",
    status: status.success ? status.data : undefined,
  };
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listEpiStock(tenantId, { ...pageParamsFrom(req), ...filtersFrom(req) }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = epiStockCreateSchema.parse(await req.json());
      return repo.createEpiStock(tenantId, input);
    },
    { status: 201 },
  );
}
