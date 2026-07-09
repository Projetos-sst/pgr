import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { categoryTypeSchema } from "@/shared/domains/pgr/validation";
import { epiCatalogInputSchema } from "@/shared/domains/pgr/epi-catalog";
import * as repo from "@/shared/db/repositories/epi-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const rawType = req.nextUrl.searchParams.get("type");
    const type = rawType ? categoryTypeSchema.parse(rawType) : undefined;
    return repo.listEpiCatalog(tenantId, { ...pageParamsFrom(req), type });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = epiCatalogInputSchema.parse(await req.json());
      return repo.createEpiCatalog(tenantId, input);
    },
    { status: 201 },
  );
}
