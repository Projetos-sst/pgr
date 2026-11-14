import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { requireMaster } from "@/shared/auth/require-master";
import {
  approveVerification,
  verificationQueue,
} from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fila do operador da plataforma (NOB-158): master pela sessão real (requireMaster, como a tela e
// as Server Actions; o bypass dev não substitui a sessão) E designado no banco, conferido pela
// conexão do papel identity_verifier. A conta do operador vem sempre da sessão de master, nunca
// do header x-dev-user. Sem master ou não designada → 403. Sem dado clínico.
export function GET(req: NextRequest) {
  return restHandler(req, async () => verificationQueue((await requireMaster()).userId), {
    tenantAccess: true,
  });
}

// Aprovação: { requestId, method, crm, registrationUf, registrySource, evidenceRef?, challengeCode, checklist }.
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async () =>
      approveVerification((await requireMaster()).userId, await readJsonBody(req)),
    { status: 201, tenantAccess: true },
  );
}
