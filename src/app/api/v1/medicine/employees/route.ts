import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { listMedicineEmployees } from "@/shared/server/medicine/overview-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-model (só GET). `companyId` obrigatório: 422 ausente/malformado, 404 empresa
// fora do tenant, 403 empresa sem Medicina (validação e checagens no core).
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    listMedicineEmployees(ctx, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
    }),
  );
}
