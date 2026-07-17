import { z } from "zod";

import { isExpired } from "@/shared/domains/signatures/token";
import type {
  SignatureStatusValue,
  SignatureStatusView,
} from "@/shared/domains/signatures/types";

/**
 * Domínio da assinatura da Ordem de Serviço (fase 06 / US3). Reusa a infraestrutura genérica
 * (`target_type: 'service_order'`, zero migration): a OS **não** tem (nem ganha) coluna de token
 * ou de estado de assinatura — tudo é derivado de `signature_requests`/`signature_captures`.
 */

/** `target_type` desta OS na infra genérica. Fonte única (registry, repo, core). */
export const SERVICE_ORDER_TARGET_TYPE = "service_order" as const;

/** Estados protegidos reais da infra (= `SignatureStatusView`). */
export type ServiceOrderSignatureStatus = SignatureStatusView; // pending | signed | expired | cancelled
/** + ausência de solicitação (derivado, nunca persistido). */
export type ServiceOrderSignatureState = "none" | ServiceOrderSignatureStatus;

/** View derivada exibida na tela protegida. NUNCA contém token, hash nem URL pública. */
export type ServiceOrderSignatureView = {
  state: ServiceOrderSignatureState;
  requestId: string | null;
  signedAt: string | null; // ISO, só quando signed
  signerName: string | null; // só quando signed
  expiresAt: string | null; // ISO, só quando pending
};

/**
 * Input do pedido protegido. `serviceOrderId` vem do path/argumento e o payload é montado no
 * servidor — nada além de `ttlSeconds` (regra de TTL da infra, sem máximo inventado aqui).
 */
export const serviceOrderSignatureRequestSchema = z
  .object({
    ttlSeconds: z.number().int().positive().optional(),
  })
  .strict();

export type ServiceOrderSignatureRequestInput = z.infer<
  typeof serviceOrderSignatureRequestSchema
>;

/** Título do documento composto NO SERVIDOR (a OS tem número + título próprios). */
export function buildServiceOrderDocumentTitle(input: {
  number: number;
  title: string;
}): string {
  return `Ordem de Serviço nº ${input.number} — ${input.title}`;
}

/** Deriva o estado protegido a partir da última solicitação (ou `none` se não houver). */
export function deriveServiceOrderSignatureState(
  row: { status: SignatureStatusValue; expiresAt: Date } | null,
): ServiceOrderSignatureState {
  if (!row) return "none";
  return isExpired(row.expiresAt, row.status) ? "expired" : row.status;
}

// ── Regras de workflow (fonte única — UI, Action e repository consultam daqui) ──

/**
 * OS assinada é **imutável**: não edita, não exclui, não emite nova solicitação equivalente.
 * A UI apenas antecipa este bloqueio; o backstop real roda no repositório, dentro da transação.
 */
export function isServiceOrderSigned(state: ServiceOrderSignatureState): boolean {
  return state === "signed";
}

export const SERVICE_ORDER_SIGNED_EDIT_MESSAGE =
  "OS assinada é imutável e não pode ser editada.";
export const SERVICE_ORDER_SIGNED_DELETE_MESSAGE = "OS assinada não pode ser excluída.";
export const SERVICE_ORDER_SIGNED_REISSUE_MESSAGE =
  "OS já assinada não pode gerar nova solicitação de assinatura.";
