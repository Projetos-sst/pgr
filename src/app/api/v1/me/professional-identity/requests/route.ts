import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { requestVerification } from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A própria conta pede a verificação de identidade ({ medicoId }); não conclui nada sozinha.
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => requestVerification(ctx, await readJsonBody(req)),
    {
      status: 201,
      tenantAccess: true,
    },
  );
}
