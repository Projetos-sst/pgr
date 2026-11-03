import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  identityStatement,
  invitationStatus,
  type InvitationEventKind,
  type InvitationView,
  type ProfessionalLinkValues,
} from "@/shared/domains/medicine/professional-links";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  medicoLinkInvitationEvents as events,
  medicoLinkInvitations as invitations,
  medicos,
  medicoUserLinks as links,
} from "../schema/medicos";
import { orgMemberships } from "../schema/org-memberships";
import { identityVerified } from "../schema/clinical-actor";
import { auditedTenantWrite } from "./audited-write";

/** Transação com o ator da sessão: as policies conferem quem convida, aceita e aprova. */
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

function assertOwner(ctx: TenantContext) {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o responsável pelo escritório pode convidar ou cancelar convites de acesso do profissional.",
    );
}

async function medicoTx(tx: TenantTransaction, orgId: string, medicoId: string) {
  const [medico] = await tx
    .select({
      id: medicos.id,
      name: medicos.name,
      crm: medicos.crm,
      profession: medicos.profession,
      registrationUf: medicos.registrationUf,
      status: medicos.status,
    })
    .from(medicos)
    .where(and(eq(medicos.orgId, orgId), eq(medicos.id, medicoId)))
    .limit(1);
  if (!medico) throw new NotFoundError();
  return medico;
}

async function eventsTx(tx: TenantTransaction, orgId: string, ids: string[]) {
  if (!ids.length) return [];
  return tx
    .select({
      invitationId: events.invitationId,
      kind: events.kind,
      actorUserId: events.actorUserId,
      occurredAt: events.occurredAt,
    })
    .from(events)
    .where(and(eq(events.orgId, orgId), inArray(events.invitationId, ids)));
}

async function viewsTx(
  tx: TenantTransaction,
  orgId: string,
  rows: (typeof invitations.$inferSelect)[],
): Promise<InvitationView[]> {
  const ids = rows.map((r) => r.id);
  const [evs, linked] = await Promise.all([
    eventsTx(tx, orgId, ids),
    ids.length
      ? tx
          .select({ invitationId: links.invitationId })
          .from(links)
          .where(and(eq(links.orgId, orgId), inArray(links.invitationId, ids)))
      : Promise.resolve([]),
  ]);
  const now = new Date();
  return rows.map((row) => {
    const mine = evs.filter((e) => e.invitationId === row.id);
    const kinds = new Set<InvitationEventKind>(mine.map((e) => e.kind));
    return {
      id: row.id,
      medicoId: row.medicoId,
      userId: row.userId,
      reason: row.reason,
      invitedBy: row.invitedBy,
      invitedAt: row.invitedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      selfInvitation: row.invitedBy === row.userId,
      status: invitationStatus({
        kinds,
        linked: linked.some((l) => l.invitationId === row.id),
        selfInvitation: row.invitedBy === row.userId,
        expired: row.expiresAt <= now,
      }),
      events: mine
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .map((e) => ({
          kind: e.kind,
          actorUserId: e.actorUserId,
          occurredAt: e.occurredAt.toISOString(),
        })),
    };
  });
}

/** Convites do profissional (histórico completo), do mais recente ao mais antigo. */
export async function listMedicoLinkInvitations(
  ctx: TenantContext,
  medicoId: string,
): Promise<InvitationView[]> {
  return actorTx(ctx, async (tx) => {
    await medicoTx(tx, ctx.tenantId, medicoId);
    const rows = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.orgId, ctx.tenantId), eq(invitations.medicoId, medicoId)))
      .orderBy(desc(invitations.invitedAt), desc(invitations.id));
    return viewsTx(tx, ctx.tenantId, rows);
  });
}

/** Convites endereçados à conta da sessão que ainda esperam o aceite dela. */
export async function listMyPendingInvitations(
  ctx: TenantContext,
): Promise<(InvitationView & { medicoName: string })[]> {
  return actorTx(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.orgId, ctx.tenantId), eq(invitations.userId, ctx.userId)))
      .orderBy(desc(invitations.invitedAt));
    const views = (await viewsTx(tx, ctx.tenantId, rows)).filter(
      (v) => v.status === "pending_acceptance",
    );
    const names = views.length
      ? await tx
          .select({ id: medicos.id, name: medicos.name })
          .from(medicos)
          .where(
            and(
              eq(medicos.orgId, ctx.tenantId),
              inArray(
                medicos.id,
                views.map((v) => v.medicoId),
              ),
            ),
          )
      : [];
    return views.map((v) => ({
      ...v,
      medicoName: names.find((n) => n.id === v.medicoId)?.name ?? "",
    }));
  });
}

/**
 * O owner convida uma conta do escritório para assumir a identidade do profissional. Não cria
 * vínculo: ele só nasce do aceite da própria conta (e da segunda aprovação no autovínculo).
 */
export async function inviteMedicoUser(
  ctx: TenantContext,
  medicoId: string,
  input: ProfessionalLinkValues,
): Promise<InvitationView> {
  assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.invite_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const medico = await medicoTx(tx, ctx.tenantId, medicoId);
        if (medico.status !== "active")
          throw new ValidationError(
            "Profissional inativo não pode receber acesso. Reative o cadastro.",
          );
        const [member] = await tx
          .select({ userId: orgMemberships.userId })
          .from(orgMemberships)
          .where(
            and(
              eq(orgMemberships.orgId, ctx.tenantId),
              eq(orgMemberships.userId, input.userId),
            ),
          )
          .limit(1);
        if (!member) throw new ValidationError("A conta não pertence a este escritório.");
        const [open] = await tx
          .select({ id: links.id })
          .from(links)
          .where(
            and(
              eq(links.orgId, ctx.tenantId),
              eq(links.medicoId, medicoId),
              isNull(links.revokedAt),
            ),
          )
          .limit(1);
        if (open)
          throw new ValidationError(
            "O profissional já tem conta vinculada. Revogue o vínculo antes de convidar outra conta.",
          );
        const pending = (await listOpenTx(tx, ctx.tenantId, medicoId)).length;
        if (pending)
          throw new ValidationError(
            "Já existe convite em aberto para este profissional. Cancele-o antes de convidar outra conta.",
          );
        const [row] = await tx
          .insert(invitations)
          .values({
            orgId: ctx.tenantId,
            medicoId,
            userId: input.userId,
            reason: input.reason,
            invitedBy: ctx.userId,
          })
          .returning();
        return (await viewsTx(tx, ctx.tenantId, [row]))[0];
      }),
  );
}

async function listOpenTx(tx: TenantTransaction, orgId: string, medicoId: string) {
  const rows = await tx
    .select()
    .from(invitations)
    .where(and(eq(invitations.orgId, orgId), eq(invitations.medicoId, medicoId)));
  return (await viewsTx(tx, orgId, rows)).filter(
    (v) => v.status === "pending_acceptance" || v.status === "pending_approval",
  );
}

async function invitationTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  medicoId: string,
  invitationId: string,
) {
  const [row] = await tx
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.orgId, ctx.tenantId),
        eq(invitations.medicoId, medicoId),
        eq(invitations.id, invitationId),
      ),
    )
    .limit(1);
  // Sem FOR UPDATE (exigiria UPDATE, que o app_runtime não tem): a concorrência é barrada pelos
  // índices únicos (um evento de cada tipo por convite; um vínculo por convite).
  if (!row) throw new NotFoundError();
  const [view] = await viewsTx(tx, ctx.tenantId, [row]);
  return { row, view };
}

async function createLinkTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  invitation: typeof invitations.$inferSelect,
) {
  await tx.insert(links).values({
    orgId: ctx.tenantId,
    medicoId: invitation.medicoId,
    userId: invitation.userId,
    reason: invitation.reason,
    linkedBy: ctx.userId,
    invitationId: invitation.id,
  });
}

/**
 * A própria conta convidada aceita, declarando que é o profissional do cadastro. Sem autovínculo,
 * o vínculo nasce aqui; no autovínculo, fica aguardando a aprovação de outro owner.
 */
export async function acceptMedicoLinkInvitation(
  ctx: TenantContext,
  medicoId: string,
  invitationId: string,
): Promise<InvitationView> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.accept_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const { row, view } = await invitationTx(tx, ctx, medicoId, invitationId);
        if (row.userId !== ctx.userId)
          throw new ForbiddenError("Só a conta convidada pode aceitar o convite.");
        if (view.status !== "pending_acceptance")
          throw new ValidationError("O convite não está aguardando aceite.");
        const medico = await medicoTx(tx, ctx.tenantId, medicoId);
        if (medico.status !== "active")
          throw new ValidationError("Profissional inativo não pode receber acesso.");
        await tx.insert(events).values({
          orgId: ctx.tenantId,
          invitationId: row.id,
          kind: "accepted",
          actorUserId: ctx.userId,
          statement: identityStatement({
            name: medico.name,
            registration: formatProfessionalRegistration(medico),
          }),
        });
        // Sem autovínculo o vínculo nasce aqui. No autovínculo, só com segunda aprovação ou com
        // identidade já verificada de forma independente (NOB-160); a RLS confere o mesmo.
        if (
          row.invitedBy !== row.userId ||
          (await identityVerifiedTx(tx, ctx.tenantId, row.medicoId, row.userId))
        )
          await createLinkTx(tx, ctx, row);
        return (await viewsTx(tx, ctx.tenantId, [row]))[0];
      }),
  );
}

/** A identidade (escritório, profissional, conta) foi verificada por operador independente e vale? */
async function identityVerifiedTx(
  tx: TenantTransaction,
  orgId: string,
  medicoId: string,
  userId: string,
): Promise<boolean> {
  const rows = (await tx.execute(
    sql`select ${identityVerified(sql`${orgId}`, sql`${medicoId}::uuid`, sql`${userId}`)} as ok`,
  )) as unknown as { ok: boolean }[];
  return rows[0]?.ok === true;
}

/**
 * NOB-160: autovínculo aceito (único owner médico) é concluído pela própria conta quando a
 * identidade dela já foi verificada pela plataforma, sem segundo owner. Sem verificação, continua a
 * falha fechada; a RLS de inclusão confere a mesma condição.
 */
export async function completeSelfInvitation(
  ctx: TenantContext,
  medicoId: string,
  invitationId: string,
): Promise<InvitationView> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.complete_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const { row, view } = await invitationTx(tx, ctx, medicoId, invitationId);
        if (row.userId !== ctx.userId)
          throw new ForbiddenError("Só a conta convidada conclui o próprio vínculo.");
        if (!view.selfInvitation || view.status !== "pending_approval")
          throw new ValidationError(
            "O convite não é um autovínculo aguardando conclusão.",
          );
        if (!(await identityVerifiedTx(tx, ctx.tenantId, row.medicoId, row.userId)))
          throw new ForbiddenError(
            "O autovínculo só é concluído sem segundo responsável depois da verificação independente da identidade profissional.",
          );
        await createLinkTx(tx, ctx, row);
        return (await viewsTx(tx, ctx.tenantId, [row]))[0];
      }),
  );
}

/** Autovínculo: outra conta owner aprova depois do aceite, e o vínculo nasce em nome dela. */
export async function approveMedicoLinkInvitation(
  ctx: TenantContext,
  medicoId: string,
  invitationId: string,
): Promise<InvitationView> {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente outro responsável pelo escritório aprova o autovínculo.",
    );
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.approve_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const { row, view } = await invitationTx(tx, ctx, medicoId, invitationId);
        if (!view.selfInvitation)
          throw new ValidationError(
            "Só o autovínculo exige segunda aprovação; este convite vale com o aceite da conta.",
          );
        if (row.userId === ctx.userId)
          throw new ForbiddenError(
            "Quem se convidou não aprova o próprio vínculo: outra conta owner precisa aprovar.",
          );
        if (view.status !== "pending_approval")
          throw new ValidationError("O convite não está aguardando aprovação.");
        await tx.insert(events).values({
          orgId: ctx.tenantId,
          invitationId: row.id,
          kind: "approved",
          actorUserId: ctx.userId,
        });
        await createLinkTx(tx, ctx, row);
        return (await viewsTx(tx, ctx.tenantId, [row]))[0];
      }),
  );
}

/** A conta convidada recusa, ou o owner cancela, um convite ainda em aberto. */
export async function closeMedicoLinkInvitation(
  ctx: TenantContext,
  medicoId: string,
  invitationId: string,
  kind: "declined" | "cancelled",
): Promise<InvitationView> {
  if (kind === "cancelled") assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.close_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const { row, view } = await invitationTx(tx, ctx, medicoId, invitationId);
        if (kind === "declined" && row.userId !== ctx.userId)
          throw new ForbiddenError("Só a conta convidada pode recusar o convite.");
        if (view.status !== "pending_acceptance" && view.status !== "pending_approval")
          throw new ValidationError("O convite já foi encerrado.");
        await tx.insert(events).values({
          orgId: ctx.tenantId,
          invitationId: row.id,
          kind,
          actorUserId: ctx.userId,
        });
        return (await viewsTx(tx, ctx.tenantId, [row]))[0];
      }),
  );
}
