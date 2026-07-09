import type { NextRequest } from "next/server";

import { lookupCnpj } from "@/shared/integrations/cnpj";
import { isValidCnpj, normalizeCnpj } from "@/shared/integrations/validation";
import {
  ensureSession,
  invalidFormat,
  respondWithProviderResult,
} from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ cnpj: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const unauthorized = await ensureSession();
  if (unauthorized) return unauthorized;

  const { cnpj } = await params;
  if (!isValidCnpj(cnpj)) return invalidFormat("CNPJ inválido.");

  const result = await lookupCnpj(normalizeCnpj(cnpj));
  return respondWithProviderResult(result, "CNPJ não encontrado.");
}
