import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { myProfessionalIdentity } from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Identidade profissional e acesso clínico da conta da sessão (NOB-158/159/160).
export function GET(req: NextRequest) {
  return restHandler(req, async (ctx) => myProfessionalIdentity(ctx), {
    tenantAccess: true,
  });
}
