import "server-only";

import { NextResponse } from "next/server";

import { requireAuth } from "@/shared/auth/require-auth";
import { UnauthorizedError } from "@/shared/auth/errors";
import { ok, fail } from "@/shared/server/result";
import type { ProviderResult } from "@/shared/integrations/providers/types";

// CEP muda raro, situação de CNPJ menos; o navegador/CDN deduplica repetições em
// sequência rápida. `s-maxage` alto assume dados quase estáticos e públicos.
const SUCCESS_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

/**
 * Garante sessão autenticada (não vira proxy aberto). Não exige tenant nem papel —
 * CEP/CNPJ são dados públicos, não dados do cliente. Retorna a resposta 401 pronta
 * quando não há sessão; `null` quando pode seguir.
 */
export async function ensureSession(): Promise<NextResponse | null> {
  try {
    await requireAuth();
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(fail("UNAUTHORIZED", "Sessão necessária."), {
        status: 401,
      });
    }
    throw error;
  }
}

export function invalidFormat(message: string): NextResponse {
  return NextResponse.json(fail("VALIDATION", message), { status: 422 });
}

/**
 * Serializa o resultado do provider no contrato `ActionResult`:
 * ok → 200 (cacheável) · not_found → 404 · timeout/erro/payload → 502 silencioso.
 */
export function respondWithProviderResult<T>(
  result: ProviderResult<T>,
  notFoundMessage: string,
): NextResponse {
  if (result.ok) {
    return NextResponse.json(ok(result.data), {
      status: 200,
      headers: { "Cache-Control": SUCCESS_CACHE_CONTROL },
    });
  }
  if (result.reason === "not_found") {
    return NextResponse.json(fail("NOT_FOUND", notFoundMessage), { status: 404 });
  }
  return NextResponse.json(fail("UPSTREAM_ERROR", "Serviço externo indisponível."), {
    status: 502,
  });
}
