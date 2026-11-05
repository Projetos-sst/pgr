import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { lookupNtepCatalog } from "@/shared/server/medicine/ntep-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista C do Anexo II do Decreto 3.048/1999 (NTEP): catálogo de referência, só leitura.
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return restHandler(req, async () =>
    lookupNtepCatalog({
      cid: q.get("cid"),
      cnae: q.get("cnae"),
      version: q.get("version"),
    }),
  );
}
