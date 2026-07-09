"use server";

import { toActionError } from "@/shared/server/action-error";
import { fail, ok, type ActionResult } from "@/shared/server/result";
import {
  publicSignatureSchema,
  type PublicSignatureInput,
} from "@/shared/domains/signatures/schemas";
import { isExpired } from "@/shared/domains/signatures/token";
import * as repo from "@/shared/db/repositories/signature-requests";

/**
 * Superfície pública (SEM gate de office staff, SEM checagem de plano — FR-022).
 * O tenant é derivado do token (policy de capability), nunca do cliente (FR-008).
 * Estados "expirado"/"já utilizado" são devolvidos como códigos para a página
 * renderizar mensagem amigável (FR-011/012/025).
 */
export async function submitPublicSignature(
  token: string,
  input: PublicSignatureInput,
): Promise<ActionResult<void>> {
  try {
    const data = publicSignatureSchema.parse(input);

    const request = await repo.getRequestByToken(token);
    if (!request) return fail("NOT_FOUND", "Link inválido.");
    if (request.usedAt || request.status !== "pending") {
      return fail("ALREADY_USED", "Este link já foi utilizado.");
    }
    if (isExpired(request.expiresAt, request.status)) {
      return fail("EXPIRED", "Este link expirou.");
    }

    const captured = await repo.consumeAndCapture(request.orgId, {
      requestId: request.id,
      imageData: data.imageDataUrl,
      signerName: data.signerName,
      method: "link",
    });
    if (!captured) return fail("ALREADY_USED", "Este link já foi utilizado.");

    return ok(undefined);
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}

export type PublicSignatureRequestView = {
  state: "signable" | "invalid" | "expired" | "used";
  requestId?: string;
  targetType?: string;
  payload?: unknown;
};

/**
 * Resolve o estado de um token para a rota pública renderizar (sem gravar).
 * Lê via policy de capability (tenant derivado do token).
 */
export async function resolvePublicSignature(
  token: string,
): Promise<PublicSignatureRequestView> {
  const request = await repo.getRequestByToken(token);
  if (!request) return { state: "invalid" };
  if (request.usedAt || request.status !== "pending") return { state: "used" };
  if (isExpired(request.expiresAt, request.status)) return { state: "expired" };
  return {
    state: "signable",
    requestId: request.id,
    targetType: request.targetType,
    payload: request.payload,
  };
}
