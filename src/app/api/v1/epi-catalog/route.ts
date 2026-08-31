import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { epiCatalogInputSchema } from "@/shared/domains/pgr/epi-catalog";
import { categoryTypeSchema } from "@/shared/domains/pgr/validation";
import type { ListEpiCatalogParams } from "@/shared/db/repositories/epi-catalog";
import * as repo from "@/shared/db/repositories/epi-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filtersFrom(req: NextRequest): Pick<ListEpiCatalogParams, "search" | "type"> {
  const sp = req.nextUrl.searchParams;
  const type = categoryTypeSchema.safeParse(sp.get("type"));
  return {
    search: sp.get("search") ?? undefined,
    type: type.success ? type.data : undefined,
  };
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listEpiCatalog(tenantId, { ...pageParamsFrom(req), ...filtersFrom(req) }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId, userId }) => {
      const input = epiCatalogInputSchema.parse(await req.json());
      // `createdBy` (issue #27) vem sempre do contexto autenticado, nunca do
      // corpo da requisição — mesma regra da Server Action.
      return repo.createEpiCatalog(tenantId, input, { createdBy: userId });
    },
    { status: 201 },
  );
}
