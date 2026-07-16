import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  buildPgrDocumentTitle,
  derivePgrSignatureState,
  type PgrSignatureView,
} from "@/shared/domains/pgr/pgr-signature";
import type { PgrSignaturePayload } from "@/shared/domains/signatures/targets/pgr";
import {
  createSignatureRequestCore,
  type CreateRequestCoreResult,
} from "@/shared/server/signatures/create-request-core";
import { getPgrSignatureSource } from "@/shared/db/repositories/pgr-signature";
import { getLatestRevisionNumber } from "@/shared/db/repositories/pgr-revisions";
import { getLatestRequestByTarget } from "@/shared/db/repositories/signature-requests";
import { getPgrById } from "@/shared/db/repositories/pgr";

const TARGET_TYPE = "pgr" as const;

export type CreatePgrSignatureOptions = { ttlSeconds?: number };

export type CreatePgrSignatureResult = {
  signature: PgrSignatureView; // estado seguro (sem token, sem URL)
} & CreateRequestCoreResult; // requestId, publicUrl (só aqui — D12), qrCodeDataUrl

/**
 * Adaptador de domínio do PGR sobre o núcleo genérico (fatia 022). Valida o PGR no tenant, monta o
 * **payload público mínimo NO SERVIDOR** (o cliente nunca o envia) e delega cota/token/persistência
 * ao core genérico. O `publicUrl` só existe nesta resposta — o token cru nunca é persistido/logado.
 */
export async function createPgrSignature(
  ctx: TenantContext,
  pgrId: string,
  options: CreatePgrSignatureOptions,
): Promise<CreatePgrSignatureResult> {
  const src = await getPgrSignatureSource(ctx.tenantId, pgrId);
  if (!src) throw new NotFoundError(); // inexistente/cross-tenant → 404, antes de cota/escrita

  const revisionNumber = await getLatestRevisionNumber(ctx.tenantId, pgrId);

  const payload: PgrSignaturePayload = {
    documentTitle: buildPgrDocumentTitle({
      companyName: src.companyName,
      workUnitName: src.workUnitName,
    }),
    companyName: src.companyName,
    workUnitName: src.workUnitName,
    responsibleName: src.responsible,
    issuedAt: src.issuedAt,
    validUntil: src.validUntil,
    revisionNumber,
  };

  const created = await createSignatureRequestCore(ctx, {
    targetType: TARGET_TYPE,
    targetId: pgrId,
    payload,
    ttlSeconds: options.ttlSeconds,
  });

  // Estado recém-criado é sempre `pending` (nenhuma linha anterior importa para a resposta).
  const signature: PgrSignatureView = {
    state: "pending",
    requestId: created.requestId,
    signedAt: null,
    signerName: null,
    expiresAt: null,
  };
  return { signature, ...created };
}

/** Estado protegido derivado da última solicitação do PGR. NUNCA reconstrói token/URL. */
export async function getPgrSignatureView(
  ctx: TenantContext,
  pgrId: string,
): Promise<PgrSignatureView> {
  if (!(await getPgrById(ctx.tenantId, pgrId))) throw new NotFoundError();
  const row = await getLatestRequestByTarget(ctx.tenantId, TARGET_TYPE, pgrId);
  if (!row) {
    return {
      state: "none",
      requestId: null,
      signedAt: null,
      signerName: null,
      expiresAt: null,
    };
  }
  const state = derivePgrSignatureState({ status: row.status, expiresAt: row.expiresAt });
  return {
    state,
    requestId: row.id,
    signedAt: row.signedAt?.toISOString() ?? null,
    signerName: row.signerName,
    expiresAt: state === "pending" ? row.expiresAt.toISOString() : null,
  };
}
