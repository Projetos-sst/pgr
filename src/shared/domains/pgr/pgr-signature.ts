import { z } from "zod";

import { isExpired } from "@/shared/domains/signatures/token";
import type {
  SignatureStatusValue,
  SignatureStatusView,
} from "@/shared/domains/signatures/types";

/**
 * Domínio da assinatura do PGR (fatia 022). Reusa a infraestrutura genérica de assinatura
 * (`target_type: 'pgr'`, zero migration). O estado exibido no PGR é **derivado** — o `pgr` não
 * tem (nem ganha) coluna de status. Nenhum enum persistido é criado aqui.
 */

/** Estados protegidos reais da infra (= `SignatureStatusView`). */
export type PgrSignatureStatus = SignatureStatusView; // pending | signed | expired | cancelled
/** + ausência de solicitação (derivado, nunca persistido). */
export type PgrSignatureState = "none" | PgrSignatureStatus;

/** View derivada exibida na tela protegida. NUNCA contém token nem URL (D12). */
export type PgrSignatureView = {
  state: PgrSignatureState;
  requestId: string | null;
  signedAt: string | null; // ISO, só quando signed
  signerName: string | null; // só quando signed
  expiresAt: string | null; // ISO, só quando pending
};

/**
 * Input do pedido protegido de assinatura. `ttlSeconds` reusa a regra da infra
 * (`int().positive()`, default 72 h aplicado pelo core). **Sem máximo inventado.** Estrito:
 * `pgrId` vem do path/argumento e o payload é montado no servidor — nada além de `ttlSeconds`.
 */
export const pgrSignatureRequestSchema = z
  .object({
    ttlSeconds: z.number().int().positive().optional(),
  })
  .strict();

export type PgrSignatureRequestInput = z.infer<typeof pgrSignatureRequestSchema>;

/** Título do documento composto NO SERVIDOR (não existe coluna de título no `pgr`). */
export function buildPgrDocumentTitle(input: {
  companyName: string;
  workUnitName: string | null;
}): string {
  return input.workUnitName
    ? `PGR — ${input.companyName} · ${input.workUnitName}`
    : `PGR — ${input.companyName}`;
}

/** Deriva o estado protegido a partir da última solicitação (ou `none` se não houver). */
export function derivePgrSignatureState(
  row: { status: SignatureStatusValue; expiresAt: Date } | null,
): PgrSignatureState {
  if (!row) return "none";
  return isExpired(row.expiresAt, row.status) ? "expired" : row.status;
}
