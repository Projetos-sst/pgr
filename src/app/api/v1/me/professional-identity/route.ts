import type { NextRequest } from "next/server";

import { isDevAuthBypassEnabled, restHandler } from "@/shared/api/rest";
import { myProfessionalIdentity } from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Identidade profissional e acesso clínico da conta da sessão (NOB-158/159/160). Com o bypass dev
// ligado, a conta vem de headers forjáveis: o código de controle da conta (prova ao vivo de que a
// pessoa controla a conta) não sai por aqui; só pela sessão real (tela /professional-identity).
export function GET(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => {
      const items = await myProfessionalIdentity(ctx);
      return isDevAuthBypassEnabled()
        ? items.map((item) => ({ ...item, challengeCode: null }))
        : items;
    },
    { tenantAccess: true },
  );
}
