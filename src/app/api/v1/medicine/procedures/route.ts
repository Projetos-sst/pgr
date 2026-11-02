import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { searchProcedureCatalog } from "@/shared/server/medicine/exam-proposal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Catálogo de referência (Tabela 27 do eSocial): só leitura, sem POST/PUT/DELETE.
export function GET(req: NextRequest) {
  return restHandler(req, async () =>
    searchProcedureCatalog(
      { search: req.nextUrl.searchParams.get("search") ?? "" },
      pageParamsFrom(req),
    ),
  );
}
