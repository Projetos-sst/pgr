import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  buildServiceOrderDocumentTitle,
  deriveServiceOrderSignatureState,
  isServiceOrderSigned,
  SERVICE_ORDER_SIGNED_REISSUE_MESSAGE,
  SERVICE_ORDER_TARGET_TYPE,
  type ServiceOrderSignatureView,
} from "@/shared/domains/safety/service-order-signature";
import type { ServiceOrderSignaturePayload } from "@/shared/domains/signatures/targets/service-order";
import {
  createSignatureRequestCore,
  type CreateRequestCoreResult,
} from "@/shared/server/signatures/create-request-core";
import { getServiceOrderSignatureSource } from "@/shared/db/repositories/service-order-signature";
import { getLatestRequestByTarget } from "@/shared/db/repositories/signature-requests";

export type CreateServiceOrderSignatureOptions = { ttlSeconds?: number };

export type CreateServiceOrderSignatureResult = {
  signature: ServiceOrderSignatureView; // estado seguro (sem token, sem URL)
} & CreateRequestCoreResult; // requestId, publicUrl (só aqui), qrCodeDataUrl

/**
 * Adaptador de domínio da OS sobre o núcleo genérico (fase 06 / US3). Valida a OS no tenant, monta
 * o **payload público mínimo NO SERVIDOR** (o cliente nunca o envia) e delega cota/token/TTL/QR/
 * persistência ao core genérico — a cota é a **compartilhada** de assinaturas, sem contador próprio.
 * O `publicUrl` só existe nesta resposta; o token cru nunca é persistido nem logado.
 */
export async function createServiceOrderSignature(
  ctx: TenantContext,
  serviceOrderId: string,
  options: CreateServiceOrderSignatureOptions,
): Promise<CreateServiceOrderSignatureResult> {
  const src = await getServiceOrderSignatureSource(ctx.tenantId, serviceOrderId);
  if (!src) throw new NotFoundError(); // inexistente/cross-tenant → 404, antes de cota/escrita

  // Já assinada não reemite (regra desta OS; a infra genérica não impede por si).
  const current = await getServiceOrderSignatureView(ctx, serviceOrderId);
  if (isServiceOrderSigned(current.state)) {
    throw new EntityInUseError(SERVICE_ORDER_SIGNED_REISSUE_MESSAGE);
  }

  // Pré-condições de emissão: OS cancelada não é assinável; sem funcionário/empresa/itens não há
  // documento a assinar (o payload público exige os seis campos preenchidos).
  if (src.status === "cancelled") {
    throw new ValidationError("OS cancelada não pode ser enviada para assinatura.");
  }
  if (!src.employeeName || !src.companyName) {
    throw new ValidationError(
      "OS precisa de funcionário vinculado (com empresa) para ser assinada.",
    );
  }
  if (src.items.length === 0) {
    throw new ValidationError("OS sem itens não pode ser enviada para assinatura.");
  }

  const payload: ServiceOrderSignaturePayload = {
    documentTitle: buildServiceOrderDocumentTitle({
      number: src.number,
      title: src.title,
    }),
    serviceOrderNumber: src.number,
    companyName: src.companyName,
    employeeName: src.employeeName,
    issuedAt: src.issuedAt,
    items: src.items.map((i) => ({ description: i.description })),
  };

  const created = await createSignatureRequestCore(ctx, {
    targetType: SERVICE_ORDER_TARGET_TYPE,
    targetId: serviceOrderId,
    payload,
    ttlSeconds: options.ttlSeconds,
  });

  // Estado recém-criado é sempre `pending` (nenhuma linha anterior importa para a resposta).
  const signature: ServiceOrderSignatureView = {
    state: "pending",
    requestId: created.requestId,
    signedAt: null,
    signerName: null,
    expiresAt: null,
  };
  return { signature, ...created };
}

/** Estado protegido derivado da última solicitação da OS. NUNCA reconstrói token/URL. */
export async function getServiceOrderSignatureView(
  ctx: TenantContext,
  serviceOrderId: string,
): Promise<ServiceOrderSignatureView> {
  if (!(await getServiceOrderSignatureSource(ctx.tenantId, serviceOrderId))) {
    throw new NotFoundError();
  }
  const row = await getLatestRequestByTarget(
    ctx.tenantId,
    SERVICE_ORDER_TARGET_TYPE,
    serviceOrderId,
  );
  if (!row) {
    return {
      state: "none",
      requestId: null,
      signedAt: null,
      signerName: null,
      expiresAt: null,
    };
  }
  const state = deriveServiceOrderSignatureState({
    status: row.status,
    expiresAt: row.expiresAt,
  });
  return {
    state,
    requestId: row.id,
    signedAt: row.signedAt?.toISOString() ?? null,
    signerName: row.signerName,
    expiresAt: state === "pending" ? row.expiresAt.toISOString() : null,
  };
}
