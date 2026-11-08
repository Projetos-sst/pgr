/**
 * Verificação independente da identidade profissional (NOB-158) e reconfirmação de vínculo legado
 * (NOB-159). Regras puras: entradas do operador, situação derivada e textos. A verificação é feita
 * por operador designado da plataforma; nada enviado pelo escritório ou pelo profissional declara
 * uma verificação concluída.
 */
import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

export const IDENTITY_VALIDITY_DEFAULT_MONTHS = 12;
export const IDENTITY_VALIDITY_MAX_MONTHS = 36;

/** Validade configurada (`IDENTITY_VERIFICATION_VALIDITY_MONTHS`), entre 1 e 36; padrão 12. */
export function identityValidityMonths(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return IDENTITY_VALIDITY_DEFAULT_MONTHS;
  return Math.min(n, IDENTITY_VALIDITY_MAX_MONTHS);
}

export const IDENTITY_METHODS = ["in_person", "live_video"] as const;
export const IDENTITY_METHOD_LABELS: Record<(typeof IDENTITY_METHODS)[number], string> = {
  in_person: "Conferência presencial",
  live_video: "Sessão de vídeo ao vivo (sem gravação)",
};

const confirmed = (label: string) => z.literal(true, { error: `Confirme: ${label}.` });

export const identityApprovalSchema = z
  .object({
    requestId: requiredUuid("Pedido inválido."),
    method: z.enum(IDENTITY_METHODS, { error: "Informe o método da conferência." }),
    crm: z
      .string({ error: "Informe o CRM conferido." })
      .trim()
      .min(1, "Informe o CRM conferido.")
      .max(30, "Máximo de 30 caracteres."),
    registrationUf: z
      .string({ error: "UF do CRM inválida." })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF do CRM inválida."),
    registrySource: z
      .string({ error: "Informe a fonte oficial consultada." })
      .trim()
      .min(3, "Informe a fonte oficial consultada.")
      .max(300, "Máximo de 300 caracteres."),
    evidenceRef: z
      .string({ error: "Referência de auditoria inválida." })
      .trim()
      .max(500, "Máximo de 500 caracteres.")
      .optional(),
    challengeCode: z
      .string({ error: "Código de controle da conta inválido." })
      .trim()
      .regex(/^\d{6}$/, "Código de controle da conta inválido."),
    checklist: z
      .object(
        {
          identityDocument: confirmed("documento oficial de identidade conferido"),
          professionalDocument: confirmed("documento ou registro profissional conferido"),
          registryStatus: confirmed("situação do CRM/UF ativa na fonte oficial"),
          personMatches: confirmed("pessoa, documentos e cadastro correspondem"),
          accountControl: confirmed("controle da conta autenticada comprovado"),
        },
        { error: "Confirme todos os itens do checklist da conferência." },
      )
      .strict(),
  })
  .strict();
export type IdentityApprovalValues = z.output<typeof identityApprovalSchema>;

export const identityDecisionReasonSchema = z
  .object({
    reason: z
      .string({ error: "Descreva o motivo." })
      .trim()
      .min(10, "Descreva o motivo (mínimo de 10 caracteres).")
      .max(1000, "Máximo de 1.000 caracteres."),
  })
  .strict();

export const identityRequestSchema = z
  .object({ medicoId: requiredUuid("Profissional inválido.") })
  .strict();

export type IdentityStatus =
  | "not_requested"
  | "in_review"
  | "rejected"
  | "verified"
  | "expired"
  | "revoked";

export const IDENTITY_STATUS_LABELS: Record<IdentityStatus, string> = {
  not_requested: "Verificação pendente: ainda não solicitada",
  in_review: "Verificação em análise pela plataforma",
  rejected: "Verificação recusada",
  verified: "Identidade verificada",
  expired: "Verificação expirada",
  revoked: "Verificação revogada",
};

/**
 * Situação da identidade de (escritório, profissional, conta), a partir do último pedido e da última
 * verificação. Verificação vale só sem revogação, dentro da validade e com CRM/UF iguais ao cadastro.
 */
export function identityStatus(input: {
  lastRequest: { id: string; rejected: boolean } | null;
  lastVerification: {
    requestId: string;
    expiresAt: string;
    revoked: boolean;
    registryMatches: boolean;
  } | null;
  now: string;
}): IdentityStatus {
  const v = input.lastVerification;
  const r = input.lastRequest;
  if (r && (!v || v.requestId !== r.id)) return r.rejected ? "rejected" : "in_review";
  if (v) {
    if (v.revoked) return "revoked";
    if (v.expiresAt <= input.now || !v.registryMatches) return "expired";
    return "verified";
  }
  return "not_requested";
}

/** Manifestação explícita do profissional ao reconfirmar um vínculo legado (NOB-159). */
export function reconfirmationStatement(medico: {
  name: string;
  registration: string;
}): string {
  return `Reconfirmo, com meu login, que sou ${medico.name}, ${medico.registration}, e que mantenho o vínculo profissional criado antes do convite com aceite.`;
}

export type ProfessionalIdentityItem = {
  medicoId: string;
  medicoName: string;
  registration: string;
  linkId: string | null;
  legacy: boolean;
  needsReconfirmation: boolean;
  pendingSelfInvitationId: string | null;
  status: IdentityStatus;
  openRequestId: string | null;
  expiresAt: string | null;
  clinicalAccess: boolean;
};

/**
 * Limites do desafio de controle da conta (NOB-158). Contam só os códigos errados:
 * - por pedido, no total: esgotado, o operador recusa o pedido e o profissional abre outro;
 * - por conta do profissional, em 24 h, somando pedidos e operadores (força bruta distribuída);
 * - por operador, em 1 h, somando todas as contas.
 * Com 6 dígitos e duas janelas válidas, o acerto por sorte fica em ~2 em 100 mil por conta por dia.
 */
export const CHALLENGE_LIMITS = {
  perRequest: 5,
  perAccount24h: 10,
  perVerifier1h: 10,
} as const;

export type ChallengeFailureCounts = {
  request: number;
  account24h: number;
  verifier1h: number;
};

export type ChallengeLock = "request" | "account" | "verifier";

/** Bloqueio vigente antes de conferir mais um código (null se ainda pode tentar). */
export function challengeLock(counts: ChallengeFailureCounts): ChallengeLock | null {
  if (counts.request >= CHALLENGE_LIMITS.perRequest) return "request";
  if (counts.account24h >= CHALLENGE_LIMITS.perAccount24h) return "account";
  if (counts.verifier1h >= CHALLENGE_LIMITS.perVerifier1h) return "verifier";
  return null;
}

export const CHALLENGE_LOCK_MESSAGES: Record<ChallengeLock, string> = {
  request:
    "Tentativas do código esgotadas neste pedido. Recuse o pedido; o profissional abre outro.",
  account:
    "Tentativas do código esgotadas para esta conta nas últimas 24 horas. Tente de novo depois.",
  verifier:
    "Você errou o código muitas vezes na última hora. A conferência fica bloqueada por enquanto.",
};

/** Tentativas que ainda restam no pedido depois de um erro. */
export function challengeAttemptsLeft(requestFailures: number): number {
  return Math.max(0, CHALLENGE_LIMITS.perRequest - requestFailures);
}
