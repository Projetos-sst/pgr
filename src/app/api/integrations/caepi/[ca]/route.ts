import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { lookupCaRecord } from "@/shared/integrations/caepi/lookup";
import { isValidCa, normalizeCa } from "@/shared/integrations/caepi/normalize";
import { ok } from "@/shared/server/result";
import { ensureSession, invalidFormat } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ca: string }> };

/**
 * Consulta local de CA (espelho CAEPI). Divergência consciente do molde CEP/CNPJ:
 * os 3 estados (`valid`/`expired`/`not_found`) são payload 200 — `not_found` é
 * resultado informativo de negócio (aviso na UI), não falha; é o que permite ao
 * hook reusar o `useLookup`. Sem cache (`no-store`): a resposta depende de "hoje".
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const unauthorized = await ensureSession();
  if (unauthorized) return unauthorized;

  const { ca } = await params;
  if (!isValidCa(ca)) return invalidFormat("CA inválido.");

  const result = await lookupCaRecord(normalizeCa(ca));
  return NextResponse.json(ok(result), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
