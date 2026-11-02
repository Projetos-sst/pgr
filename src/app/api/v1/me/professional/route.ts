import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { myProfile } from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Perfil profissional da conta da sessão (`null` sem vínculo aberto) e empresas coordenadas.
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => myProfile(ctx));
}
