import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { pgrCreateSchema } from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listPgr(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
      workUnitId: req.nextUrl.searchParams.get("workUnitId") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const parsed = pgrCreateSchema.parse(await req.json());
      // Aceite validado no servidor e NÃO persistido.
      const { declarationAccepted: _accepted, ...values } = parsed;
      return repo.createPgr(tenantId, values);
    },
    { status: 201 },
  );
}
