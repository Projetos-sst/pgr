import type { NextRequest } from "next/server";

import { lookupCep } from "@/shared/integrations/cep";
import { isValidCep, normalizeCep } from "@/shared/integrations/validation";
import {
  ensureSession,
  invalidFormat,
  respondWithProviderResult,
} from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ cep: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const unauthorized = await ensureSession();
  if (unauthorized) return unauthorized;

  const { cep } = await params;
  if (!isValidCep(cep)) return invalidFormat("CEP inválido.");

  const result = await lookupCep(normalizeCep(cep));
  return respondWithProviderResult(result, "CEP não encontrado.");
}
