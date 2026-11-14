import "server-only";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  CHALLENGE_LOCK_MESSAGES,
  challengeLock,
  identityStatus,
  reconfirmationStatement,
  type IdentityApprovalValues,
  type ProfessionalIdentityItem,
} from "@/shared/domains/medicine/professional-identity";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withVerifier, type VerifierTransaction } from "../identity-verifier-db";
import { withOrg, type TenantTransaction } from "../with-org";
import {
  medicoLinkInvitationEvents as invitationEvents,
  medicoLinkInvitations as invitations,
  medicos,
  medicoUserLinks as links,
} from "../schema/medicos";
import { identityEffectiveExpiry } from "../schema/clinical-actor";
import { orgs } from "../schema/orgs";
import {
  identityChallengeAttempts as attempts,
  identityVerifiers,
  medicoLinkReconfirmations as reconfirmations,
  professionalIdentityRequests as requests,
  professionalIdentityReviewEvents as reviews,
  professionalIdentityVerifications as verifications,
} from "../schema/professional-identity";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

type Tx = TenantTransaction | VerifierTransaction;

/**
 * Validade efetiva lida pelo app (situação, renovação e fila do operador): o menor entre
 * `expires_at` e `verified_at + 12 meses`, a mesma regra de `actor_clinical_medico_ids` (NOB-158).
 * As datas gravadas não mudam.
 */
const effectiveExpiry = identityEffectiveExpiry(
  verifications.verifiedAt,
  verifications.expiresAt,
).mapWith(verifications.expiresAt);

/** Último pedido e última verificação de cada profissional para a conta (no escritório). */
type IdentityState = {
  status: ReturnType<typeof identityStatus>;
  openRequestId: string | null;
  expiresAt: string | null;
};

async function identityStateTx(
  tx: Tx,
  orgId: string,
  userId: string,
  medicoIds: string[],
): Promise<Map<string, IdentityState>> {
  if (!medicoIds.length) return new Map();
  const reqRows = await tx
    .select({
      id: requests.id,
      medicoId: requests.medicoId,
      requestedAt: requests.requestedAt,
    })
    .from(requests)
    .where(
      and(
        eq(requests.orgId, orgId),
        eq(requests.userId, userId),
        inArray(requests.medicoId, medicoIds),
      ),
    )
    .orderBy(desc(requests.requestedAt));
  const verRows = await tx
    .select({
      id: verifications.id,
      requestId: verifications.requestId,
      medicoId: verifications.medicoId,
      crm: verifications.crm,
      uf: verifications.registrationUf,
      expiresAt: effectiveExpiry,
      verifiedAt: verifications.verifiedAt,
      currentCrm: medicos.crm,
      currentUf: medicos.registrationUf,
    })
    .from(verifications)
    .innerJoin(
      medicos,
      and(eq(medicos.id, verifications.medicoId), eq(medicos.orgId, verifications.orgId)),
    )
    .where(
      and(
        eq(verifications.orgId, orgId),
        eq(verifications.userId, userId),
        inArray(verifications.medicoId, medicoIds),
      ),
    )
    .orderBy(desc(verifications.verifiedAt));
  const reviewRows = await tx
    .select({
      kind: reviews.kind,
      requestId: reviews.requestId,
      verificationId: reviews.verificationId,
    })
    .from(reviews)
    .where(eq(reviews.orgId, orgId));
  const now = new Date().toISOString();
  const out = new Map<string, IdentityState>();
  for (const medicoId of medicoIds) {
    const r = reqRows.find((x) => x.medicoId === medicoId) ?? null;
    const v = verRows.find((x) => x.medicoId === medicoId) ?? null;
    const status = identityStatus({
      lastRequest: r
        ? {
            id: r.id,
            rejected: reviewRows.some(
              (e) => e.kind === "rejected" && e.requestId === r.id,
            ),
          }
        : null,
      lastVerification: v
        ? {
            requestId: v.requestId,
            expiresAt: v.expiresAt.toISOString(),
            revoked: reviewRows.some(
              (e) => e.kind === "revoked" && e.verificationId === v.id,
            ),
            registryMatches: v.crm === v.currentCrm && v.uf === v.currentUf,
          }
        : null,
      now,
    });
    out.set(medicoId, {
      status,
      openRequestId: status === "in_review" ? (r?.id ?? null) : null,
      expiresAt: v ? v.expiresAt.toISOString() : null,
    });
  }
  return out;
}

// ── Lado do profissional (app_runtime, conta da sessão) ─────────────────────

/** Situação da identidade e do acesso clínico da conta da sessão em cada cadastro que ela assume. */
export async function getMyProfessionalIdentity(
  ctx: TenantContext,
): Promise<ProfessionalIdentityItem[]> {
  return actorTx(ctx, async (tx) => {
    const linkRows = await tx
      .select({
        linkId: links.id,
        medicoId: links.medicoId,
        invitationId: links.invitationId,
        name: medicos.name,
        crm: medicos.crm,
        profession: medicos.profession,
        registrationUf: medicos.registrationUf,
        reconfirmedId: reconfirmations.id,
      })
      .from(links)
      .innerJoin(
        medicos,
        and(eq(medicos.id, links.medicoId), eq(medicos.orgId, links.orgId)),
      )
      .leftJoin(
        reconfirmations,
        and(eq(reconfirmations.linkId, links.id), eq(reconfirmations.orgId, links.orgId)),
      )
      .where(
        and(
          eq(links.orgId, ctx.tenantId),
          eq(links.userId, ctx.userId),
          isNull(links.revokedAt),
        ),
      );
    // Autovínculos aceitos ainda sem vínculo (único owner médico, NOB-160).
    const inviteRows = await tx
      .select({
        id: invitations.id,
        medicoId: invitations.medicoId,
        invitedBy: invitations.invitedBy,
        expiresAt: invitations.expiresAt,
        name: medicos.name,
        crm: medicos.crm,
        profession: medicos.profession,
        registrationUf: medicos.registrationUf,
      })
      .from(invitations)
      .innerJoin(
        medicos,
        and(eq(medicos.id, invitations.medicoId), eq(medicos.orgId, invitations.orgId)),
      )
      .where(
        and(eq(invitations.orgId, ctx.tenantId), eq(invitations.userId, ctx.userId)),
      );
    const evs = inviteRows.length
      ? await tx
          .select({
            invitationId: invitationEvents.invitationId,
            kind: invitationEvents.kind,
          })
          .from(invitationEvents)
          .where(
            and(
              eq(invitationEvents.orgId, ctx.tenantId),
              inArray(
                invitationEvents.invitationId,
                inviteRows.map((i) => i.id),
              ),
            ),
          )
      : [];
    const linkedInvites = inviteRows.length
      ? await tx
          .select({ invitationId: links.invitationId })
          .from(links)
          .where(
            and(
              eq(links.orgId, ctx.tenantId),
              inArray(
                links.invitationId,
                inviteRows.map((i) => i.id),
              ),
            ),
          )
      : [];
    const now = new Date();
    const pendingSelf = inviteRows.filter((i) => {
      const kinds = new Set(
        evs.filter((e) => e.invitationId === i.id).map((e) => e.kind),
      );
      return (
        i.invitedBy === ctx.userId &&
        kinds.has("accepted") &&
        !kinds.has("approved") &&
        !kinds.has("declined") &&
        !kinds.has("cancelled") &&
        i.expiresAt > now &&
        !linkedInvites.some((l) => l.invitationId === i.id) &&
        !linkRows.some((l) => l.medicoId === i.medicoId)
      );
    });
    const medicoIds = [
      ...new Set([
        ...linkRows.map((l) => l.medicoId),
        ...pendingSelf.map((i) => i.medicoId),
      ]),
    ];
    const state = await identityStateTx(tx, ctx.tenantId, ctx.userId, medicoIds);
    const clinical = new Set(await actorClinicalMedicoIdsTx(tx, ctx.tenantId));
    const items: ProfessionalIdentityItem[] = [];
    for (const l of linkRows) {
      const s = state.get(l.medicoId)!;
      items.push({
        medicoId: l.medicoId,
        medicoName: l.name,
        registration: formatProfessionalRegistration(l),
        linkId: l.linkId,
        legacy: l.invitationId === null,
        needsReconfirmation: l.invitationId === null && !l.reconfirmedId,
        pendingSelfInvitationId: null,
        status: s.status,
        openRequestId: s.openRequestId,
        expiresAt: s.expiresAt,
        clinicalAccess: clinical.has(l.medicoId),
      });
    }
    for (const i of pendingSelf) {
      const s = state.get(i.medicoId)!;
      items.push({
        medicoId: i.medicoId,
        medicoName: i.name,
        registration: formatProfessionalRegistration(i),
        linkId: null,
        legacy: false,
        needsReconfirmation: false,
        pendingSelfInvitationId: i.id,
        status: s.status,
        openRequestId: s.openRequestId,
        expiresAt: s.expiresAt,
        clinicalAccess: false,
      });
    }
    return items;
  });
}

/** A própria conta pede a verificação de identidade para o cadastro que assume (a RLS confere). */
export async function requestIdentityVerification(
  ctx: TenantContext,
  medicoId: string,
): Promise<{ id: string }> {
  return auditedTenantWrite(ctx.tenantId, "medicine.identity.request_rejected", () =>
    actorTx(ctx, async (tx) => {
      const state = await identityStateTx(tx, ctx.tenantId, ctx.userId, [medicoId]);
      const status = state.get(medicoId)?.status;
      if (status === "in_review")
        throw new ValidationError("Já existe pedido em análise.");
      if (status === "verified")
        throw new ValidationError("A identidade já está verificada.");
      try {
        const [row] = await tx
          .insert(requests)
          .values({ orgId: ctx.tenantId, medicoId, userId: ctx.userId })
          .returning({ id: requests.id });
        return row;
      } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (code === "42501")
          throw new ForbiddenError(
            "A verificação só é pedida pela própria conta vinculada (ou com autovínculo aceito) a este profissional.",
          );
        throw error;
      }
    }),
  );
}

/** Reconfirmação explícita do vínculo legado pela própria conta (NOB-159). */
export async function reconfirmLegacyLink(
  ctx: TenantContext,
  linkId: string,
): Promise<{ id: string }> {
  return auditedTenantWrite(ctx.tenantId, "medicine.identity.reconfirm_rejected", () =>
    actorTx(ctx, async (tx) => {
      const [link] = await tx
        .select({
          id: links.id,
          userId: links.userId,
          invitationId: links.invitationId,
          revokedAt: links.revokedAt,
          name: medicos.name,
          crm: medicos.crm,
          profession: medicos.profession,
          registrationUf: medicos.registrationUf,
        })
        .from(links)
        .innerJoin(
          medicos,
          and(eq(medicos.id, links.medicoId), eq(medicos.orgId, links.orgId)),
        )
        .where(and(eq(links.orgId, ctx.tenantId), eq(links.id, linkId)))
        .limit(1);
      if (!link) throw new NotFoundError();
      if (link.userId !== ctx.userId)
        throw new ForbiddenError("Só a própria conta vinculada reconfirma o vínculo.");
      if (link.revokedAt)
        throw new ValidationError("Vínculo revogado não é reconfirmado.");
      if (link.invitationId)
        throw new ValidationError(
          "Só vínculos anteriores ao convite com aceite são reconfirmados.",
        );
      try {
        const [row] = await tx
          .insert(reconfirmations)
          .values({
            orgId: ctx.tenantId,
            linkId,
            userId: ctx.userId,
            statement: reconfirmationStatement({
              name: link.name,
              registration: formatProfessionalRegistration(link),
            }),
          })
          .returning({ id: reconfirmations.id });
        return row;
      } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (code === "23505") throw new ValidationError("O vínculo já foi reconfirmado.");
        throw error;
      }
    }),
  );
}

// ── Lado do operador da plataforma (papel identity_verifier) ────────────────

async function assertDesignatedTx(tx: VerifierTransaction, userId: string) {
  const [row] = await tx
    .select({ id: identityVerifiers.id })
    .from(identityVerifiers)
    .where(and(eq(identityVerifiers.userId, userId), isNull(identityVerifiers.revokedAt)))
    .limit(1);
  if (!row)
    throw new ForbiddenError(
      "Somente operador designado da plataforma confere identidade profissional.",
    );
}

export type VerificationQueueItem = {
  requestId: string;
  orgId: string;
  orgName: string | null;
  medicoId: string;
  medicoName: string;
  crm: string;
  registrationUf: string | null;
  userId: string;
  requestedAt: string;
};

export type ActiveVerificationItem = {
  verificationId: string;
  orgName: string | null;
  medicoName: string;
  crm: string;
  registrationUf: string;
  userId: string;
  verifiedBy: string;
  verifiedAt: string;
  expiresAt: string;
};

/** Fila do operador: pedidos em aberto e verificações vigentes (só metadados, nenhum dado clínico). */
export async function listVerificationQueue(verifierUserId: string): Promise<{
  pending: VerificationQueueItem[];
  active: ActiveVerificationItem[];
}> {
  return withVerifier(verifierUserId, async (tx) => {
    await assertDesignatedTx(tx, verifierUserId);
    const reviewRows = await tx
      .select({
        kind: reviews.kind,
        requestId: reviews.requestId,
        verificationId: reviews.verificationId,
      })
      .from(reviews);
    const verRows = await tx
      .select({
        id: verifications.id,
        requestId: verifications.requestId,
        crm: verifications.crm,
        uf: verifications.registrationUf,
        userId: verifications.userId,
        verifiedBy: verifications.verifiedBy,
        verifiedAt: verifications.verifiedAt,
        expiresAt: effectiveExpiry,
        orgName: orgs.name,
        medicoName: medicos.name,
      })
      .from(verifications)
      .innerJoin(orgs, eq(orgs.id, verifications.orgId))
      .innerJoin(
        medicos,
        and(
          eq(medicos.id, verifications.medicoId),
          eq(medicos.orgId, verifications.orgId),
        ),
      )
      .orderBy(desc(verifications.verifiedAt));
    const reqRows = await tx
      .select({
        requestId: requests.id,
        orgId: requests.orgId,
        orgName: orgs.name,
        medicoId: requests.medicoId,
        medicoName: medicos.name,
        crm: medicos.crm,
        registrationUf: medicos.registrationUf,
        userId: requests.userId,
        requestedAt: requests.requestedAt,
      })
      .from(requests)
      .innerJoin(orgs, eq(orgs.id, requests.orgId))
      .innerJoin(
        medicos,
        and(eq(medicos.id, requests.medicoId), eq(medicos.orgId, requests.orgId)),
      )
      .orderBy(requests.requestedAt);
    const now = new Date();
    return {
      pending: reqRows
        .filter(
          (r) =>
            !verRows.some((v) => v.requestId === r.requestId) &&
            !reviewRows.some((e) => e.kind === "rejected" && e.requestId === r.requestId),
        )
        .map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString() })),
      active: verRows
        .filter(
          (v) =>
            v.expiresAt > now &&
            !reviewRows.some((e) => e.kind === "revoked" && e.verificationId === v.id),
        )
        .map((v) => ({
          verificationId: v.id,
          orgName: v.orgName,
          medicoName: v.medicoName,
          crm: v.crm,
          registrationUf: v.uf,
          userId: v.userId,
          verifiedBy: v.verifiedBy,
          verifiedAt: v.verifiedAt.toISOString(),
          expiresAt: v.expiresAt.toISOString(),
        })),
    };
  });
}

export type ChallengeAttemptResult = {
  request: { id: string; orgId: string; medicoId: string; userId: string };
  succeeded: boolean;
  requestFailures: number;
};

/**
 * Confere o código de controle da conta e registra a tentativa (só inclusão), sob os limites por
 * pedido, por conta do profissional e por operador. Tentativas da mesma conta e do mesmo operador
 * são serializadas (advisory lock da transação), para que pedidos paralelos não furem o limite.
 * Com o limite esgotado, nada é conferido nem gravado. O código nunca é gravado.
 */
export async function attemptChallenge(
  verifierUserId: string,
  requestId: string,
  matches: (request: { id: string; userId: string }) => boolean,
): Promise<ChallengeAttemptResult> {
  try {
    return await withVerifier(verifierUserId, async (tx) => {
      await assertDesignatedTx(tx, verifierUserId);
      const [request] = await tx
        .select({
          id: requests.id,
          orgId: requests.orgId,
          medicoId: requests.medicoId,
          userId: requests.userId,
        })
        .from(requests)
        .where(eq(requests.id, requestId))
        .limit(1);
      if (!request) throw new NotFoundError();
      const [closed] = await tx
        .select({ id: verifications.id })
        .from(verifications)
        .where(eq(verifications.requestId, request.id))
        .union(
          tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(and(eq(reviews.requestId, request.id), eq(reviews.kind, "rejected"))),
        )
        .limit(1);
      if (closed) throw new ValidationError("O pedido não está mais em aberto.");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`identity-challenge:account:${request.userId}`}, 0))`,
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`identity-challenge:verifier:${verifierUserId}`}, 0))`,
      );
      const [counts] = await tx
        .select({
          request: sql<number>`count(*) filter (where ${attempts.requestId} = ${request.id})::int`,
          account24h: sql<number>`count(*) filter (where ${attempts.userId} = ${request.userId} and ${attempts.attemptedAt} > now() - interval '24 hours')::int`,
          verifier1h: sql<number>`count(*) filter (where ${attempts.verifierUserId} = ${verifierUserId} and ${attempts.attemptedAt} > now() - interval '1 hour')::int`,
        })
        .from(attempts)
        .where(
          and(
            eq(attempts.succeeded, false),
            or(
              eq(attempts.requestId, request.id),
              eq(attempts.userId, request.userId),
              eq(attempts.verifierUserId, verifierUserId),
            ),
          ),
        );
      const lock = challengeLock(counts);
      if (lock) throw new ValidationError(CHALLENGE_LOCK_MESSAGES[lock]);
      const succeeded = matches(request);
      await tx.insert(attempts).values({
        orgId: request.orgId,
        requestId: request.id,
        userId: request.userId,
        verifierUserId,
        succeeded,
      });
      return {
        request,
        succeeded,
        requestFailures: counts.request + (succeeded ? 0 : 1),
      };
    });
  } catch (error) {
    if (rlsDenied(error))
      throw new ForbiddenError(
        "Conferência recusada pelo banco: o operador precisa ser designado e independente do escritório.",
      );
    throw error;
  }
}

function rlsDenied(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code: unknown }).code === "42501") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * O operador registra a verificação aprovada. O banco exige: operador designado, não membro do
 * escritório, diferente da conta verificada, pedido em aberto da própria conta, CRM/UF iguais ao
 * cadastro e checklist completo.
 */
export async function approveIdentityVerification(
  verifierUserId: string,
  input: IdentityApprovalValues,
  validityMonths: number,
): Promise<{ id: string }> {
  try {
    return await withVerifier(verifierUserId, async (tx) => {
      await assertDesignatedTx(tx, verifierUserId);
      const [req] = await tx
        .select({
          id: requests.id,
          orgId: requests.orgId,
          medicoId: requests.medicoId,
          userId: requests.userId,
        })
        .from(requests)
        .where(eq(requests.id, input.requestId))
        .limit(1);
      if (!req) throw new NotFoundError();
      const [row] = await tx
        .insert(verifications)
        .values({
          orgId: req.orgId,
          requestId: req.id,
          medicoId: req.medicoId,
          userId: req.userId,
          crm: input.crm,
          registrationUf: input.registrationUf,
          method: input.method,
          checklist: input.checklist,
          registrySource: input.registrySource,
          evidenceRef: input.evidenceRef || null,
          verifiedBy: verifierUserId,
          // Mesmo `now()` de `verified_at` (padrão da coluna): a validade é exatamente
          // `verified_at + N meses` pela aritmética do Postgres, a mesma do CHECK (sem a virada
          // de mês do JS, ex.: 29/02 + 12 meses).
          expiresAt: sql`now() + make_interval(months => ${validityMonths})`,
        })
        .returning({ id: verifications.id });
      return row;
    });
  } catch (error) {
    if (rlsDenied(error))
      throw new ForbiddenError(
        "Verificação recusada pelo banco: o operador precisa ser independente do escritório e da conta, o pedido precisa estar em aberto e o CRM/UF conferidos precisam corresponder ao cadastro.",
      );
    throw error;
  }
}

async function reviewEvent(
  verifierUserId: string,
  values: { kind: "rejected" | "revoked"; id: string; reason: string },
) {
  try {
    return await withVerifier(verifierUserId, async (tx) => {
      await assertDesignatedTx(tx, verifierUserId);
      const table = values.kind === "rejected" ? requests : verifications;
      const [target] = await tx
        .select({ orgId: table.orgId })
        .from(table)
        .where(eq(table.id, values.id))
        .limit(1);
      if (!target) throw new NotFoundError();
      const [row] = await tx
        .insert(reviews)
        .values({
          orgId: target.orgId,
          kind: values.kind,
          requestId: values.kind === "rejected" ? values.id : null,
          verificationId: values.kind === "revoked" ? values.id : null,
          reason: values.reason,
          actorUserId: verifierUserId,
        })
        .returning({ id: reviews.id });
      return row;
    });
  } catch (error) {
    if (rlsDenied(error))
      throw new ForbiddenError(
        "Decisão recusada: o operador precisa ser independente do escritório.",
      );
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new ValidationError("A decisão já foi registrada.");
    throw error;
  }
}

export function rejectIdentityRequest(
  verifierUserId: string,
  requestId: string,
  reason: string,
) {
  return reviewEvent(verifierUserId, { kind: "rejected", id: requestId, reason });
}

export function revokeIdentityVerification(
  verifierUserId: string,
  verificationId: string,
  reason: string,
) {
  return reviewEvent(verifierUserId, { kind: "revoked", id: verificationId, reason });
}
