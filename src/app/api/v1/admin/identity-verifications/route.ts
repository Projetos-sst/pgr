import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  approveVerification,
  verificationQueue,
} from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fila do operador designado (NOB-158). A designação é conferida no banco pela conexão do papel
// identity_verifier; conta não designada → 403. Sem dado clínico.
export function GET(req: NextRequest) {
  return restHandler(req, async (ctx) => verificationQueue(ctx.userId), {
    tenantAccess: true,
  });
}

// Aprovação: { requestId, method, crm, registrationUf, registrySource, evidenceRef?, challengeCode, checklist }.
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => approveVerification(ctx.userId, await readJsonBody(req)),
    { status: 201, tenantAccess: true },
  );
}
