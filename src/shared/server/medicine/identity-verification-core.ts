import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { verifierConfigured } from "@/shared/db/identity-verifier-db";
import * as repo from "@/shared/db/repositories/professional-identity";
import {
  challengeAttemptsLeft,
  identityApprovalSchema,
  identityDecisionReasonSchema,
  identityRequestSchema,
  identityValidityMonths,
} from "@/shared/domains/medicine/professional-identity";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";

import {
  challengeAvailable,
  challengeMatches,
  currentChallengeCode,
} from "./identity-challenge";

const uuid = (label: string) => (id: string) =>
  requiredUuid(`${label} inválido.`).parse(id);

// ── Profissional (conta da sessão) ───────────────────────────────────────────

/**
 * Identidade e acesso clínico da conta da sessão. Com pedido em análise, devolve o código de
 * controle da conta que o profissional mostra ao operador (só nesta sessão autenticada).
 */
export async function myProfessionalIdentity(ctx: TenantContext) {
  const items = await repo.getMyProfessionalIdentity(ctx);
  return items.map((item) => ({
    ...item,
    challengeCode: item.openRequestId
      ? currentChallengeCode(item.openRequestId, ctx.userId)
      : null,
  }));
}

export async function requestVerification(ctx: TenantContext, input: unknown) {
  const { medicoId } = identityRequestSchema.parse(input);
  return repo.requestIdentityVerification(ctx, medicoId);
}

export async function reconfirmLink(ctx: TenantContext, linkId: string) {
  return repo.reconfirmLegacyLink(ctx, uuid("Vínculo")(linkId));
}

// ── Operador designado da plataforma ─────────────────────────────────────────

/** Disponibilidade da verificação: conexão do operador e segredo do desafio configurados. */
export function verificationAvailability() {
  const available = verifierConfigured() && challengeAvailable();
  return {
    available,
    validityMonths: identityValidityMonths(
      process.env.IDENTITY_VERIFICATION_VALIDITY_MONTHS,
    ),
    reason: available
      ? null
      : "Verificação indisponível: falta configurar a conta do operador (IDENTITY_VERIFIER_DATABASE_URL) e o segredo do desafio (IDENTITY_CHALLENGE_SECRET). O acesso clínico continua bloqueado.",
  };
}

export async function verificationQueue(verifierUserId: string) {
  const availability = verificationAvailability();
  if (!availability.available) return { ...availability, pending: [], active: [] };
  return { ...availability, ...(await repo.listVerificationQueue(verifierUserId)) };
}

/**
 * Aprovação pelo operador: checklist completo, CRM/UF conferidos e o código de controle da conta
 * mostrado ao vivo pela própria conta do profissional, sob limite de tentativas (cada conferência
 * fica registrada). A validade vem da configuração.
 */
export async function approveVerification(verifierUserId: string, input: unknown) {
  const values = identityApprovalSchema.parse(input);
  if (!verificationAvailability().available)
    throw new ValidationError(verificationAvailability().reason!);
  const attempt = await repo.attemptChallenge(verifierUserId, values.requestId, (r) =>
    challengeMatches(r.id, r.userId, values.challengeCode),
  );
  if (!attempt.succeeded) {
    const left = challengeAttemptsLeft(attempt.requestFailures);
    throw new ValidationError(
      left > 0
        ? `O código de controle da conta não confere: peça ao profissional o código exibido agora na sessão dele. Restam ${left} tentativa(s) neste pedido.`
        : "O código de controle da conta não confere e as tentativas deste pedido acabaram. Recuse o pedido; o profissional abre outro.",
    );
  }
  const months = identityValidityMonths(
    process.env.IDENTITY_VERIFICATION_VALIDITY_MONTHS,
  );
  return repo.approveIdentityVerification(verifierUserId, values, months);
}

export async function rejectRequest(
  verifierUserId: string,
  requestId: string,
  input: unknown,
) {
  const id = uuid("Pedido")(requestId);
  const { reason } = identityDecisionReasonSchema.parse(input);
  return repo.rejectIdentityRequest(verifierUserId, id, reason);
}

export async function revokeVerification(
  verifierUserId: string,
  verificationId: string,
  input: unknown,
) {
  const id = uuid("Verificação")(verificationId);
  const { reason } = identityDecisionReasonSchema.parse(input);
  return repo.revokeIdentityVerification(verifierUserId, id, reason);
}
