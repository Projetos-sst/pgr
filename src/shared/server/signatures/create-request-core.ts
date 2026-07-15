import "server-only";

import QRCode from "qrcode";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { getPayloadSchema } from "@/shared/domains/signatures/contract";
import type { SignatureTargetType } from "@/shared/domains/signatures/contract";
import {
  computeExpiresAt,
  generateToken,
  hashToken,
} from "@/shared/domains/signatures/token";
import { buildPublicSignatureUrl } from "@/shared/domains/signatures/public-url";
import { FREE_SIGNATURE_MONTHLY_QUOTA, isSignatureAvailable } from "@/shared/tenant/plan";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import * as repo from "@/shared/db/repositories/signature-requests";

export type CreateRequestCoreInput = {
  targetType: SignatureTargetType;
  targetId?: string;
  payload: unknown; // validado aqui pelo payloadSchema do registry
  ttlSeconds?: number;
};

export type CreateRequestCoreResult = {
  requestId: string;
  publicUrl: string; // ⚠️ só existe AQUI — o token cru nunca é persistido (D12)
  qrCodeDataUrl: string;
};

/**
 * Núcleo GENÉRICO da criação de solicitação de assinatura (fatia 022 — extraído de
 * `actions/signatures.ts` para que a **regra de cota viva uma única vez**). Consumido pela
 * Action `demo`, pelo core do PGR e (via este) pelo REST do PGR.
 *
 * Passos: valida o payload pelo registry → **gate de cota** (contador por tenant/mês, sem filtro
 * de `target_type`; `free` limitado, `pro` ilimitado → `QuotaExceededError`) → gera token de alta
 * entropia → persiste apenas o **hash** → monta URL pública + QR. O token cru **nunca** é logado
 * nem persistido.
 */
export async function createSignatureRequestCore(
  ctx: TenantContext,
  input: CreateRequestCoreInput,
): Promise<CreateRequestCoreResult> {
  const payload = getPayloadSchema(input.targetType).parse(input.payload);

  const monthlyCount = await repo.countRequestsInCurrentMonth(ctx.tenantId);
  if (!isSignatureAvailable(ctx.plan, monthlyCount)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_SIGNATURE_MONTHLY_QUOTA} assinaturas/mês do plano free atingido.`,
    );
  }

  const rawToken = generateToken();
  const { id } = await repo.createRequest(ctx.tenantId, {
    targetType: input.targetType,
    targetId: input.targetId,
    tokenHash: hashToken(rawToken),
    payload,
    expiresAt: computeExpiresAt(input.ttlSeconds),
  });

  const publicUrl = buildPublicSignatureUrl(rawToken);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);
  return { requestId: id, publicUrl, qrCodeDataUrl };
}
