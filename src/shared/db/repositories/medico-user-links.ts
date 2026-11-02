import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import type {
  ProfessionalLinkValues,
  ProfessionalRevokeValues,
} from "@/shared/domains/medicine/professional-links";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import {
  medicos,
  medicoUserLinks as links,
  pcmsoCoordinatorAssignments as assignments,
  type MedicoUserLink,
} from "../schema/medicos";
import { orgMemberships } from "../schema/org-memberships";
import { auditedTenantWrite } from "./audited-write";

/** Transação com o ator da sessão (as policies de escrita conferem owner + autoria). */
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

function assertOwner(ctx: TenantContext) {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o responsável pelo escritório pode vincular ou revogar o acesso do profissional.",
    );
}

async function medicoTx(tx: TenantTransaction, orgId: string, medicoId: string) {
  const [medico] = await tx
    .select({ id: medicos.id, status: medicos.status })
    .from(medicos)
    .where(and(eq(medicos.orgId, orgId), eq(medicos.id, medicoId)))
    .limit(1);
  if (!medico) throw new NotFoundError();
  return medico;
}

/** Histórico de vínculos do profissional, do mais recente ao mais antigo. */
export async function listMedicoUserLinks(
  ctx: TenantContext,
  medicoId: string,
): Promise<MedicoUserLink[]> {
  return actorTx(ctx, async (tx) => {
    await medicoTx(tx, ctx.tenantId, medicoId);
    return tx
      .select()
      .from(links)
      .where(and(eq(links.orgId, ctx.tenantId), eq(links.medicoId, medicoId)))
      .orderBy(desc(links.linkedAt), desc(links.id));
  });
}

export async function linkMedicoUser(
  ctx: TenantContext,
  medicoId: string,
  input: ProfessionalLinkValues,
): Promise<MedicoUserLink> {
  assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.link_rejected",
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
        // Os índices únicos parciais barram vínculo aberto duplicado (DUPLICATE) em concorrência.
        const [created] = await tx
          .insert(links)
          .values({
            orgId: ctx.tenantId,
            medicoId,
            userId: input.userId,
            reason: input.reason,
            linkedBy: ctx.userId,
          })
          .returning();
        return created;
      }),
  );
}

export async function revokeMedicoUserLink(
  ctx: TenantContext,
  medicoId: string,
  linkId: string,
  input: ProfessionalRevokeValues,
): Promise<MedicoUserLink> {
  assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.professional_links.revoke_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        await medicoTx(tx, ctx.tenantId, medicoId);
        const [updated] = await tx
          .update(links)
          .set({
            revokedAt: new Date(),
            revokedBy: ctx.userId,
            revokeReason: input.reason,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(links.orgId, ctx.tenantId),
              eq(links.medicoId, medicoId),
              eq(links.id, linkId),
              isNull(links.revokedAt),
            ),
          )
          .returning();
        if (!updated) throw new NotFoundError();
        return updated;
      }),
  );
}

export type ProfessionalProfile = {
  linkId: string;
  medicoId: string;
  name: string;
  crm: string;
  registrationUf: string | null;
  rqe: string | null;
  profession: "physician" | "psychologist";
  coordinatedCompanies: { companyId: string; razaoSocial: string; startsOn: string }[];
};

/**
 * Perfil profissional da conta da sessão: vínculo aberto + profissional ativo + associação viva
 * ao escritório. Sem isso, `null` — a conta não age como profissional.
 */
export async function getActorProfessionalProfile(
  ctx: TenantContext,
): Promise<ProfessionalProfile | null> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select({
        linkId: links.id,
        medicoId: medicos.id,
        name: medicos.name,
        crm: medicos.crm,
        registrationUf: medicos.registrationUf,
        rqe: medicos.rqe,
        profession: medicos.profession,
      })
      .from(links)
      .innerJoin(
        medicos,
        and(eq(medicos.id, links.medicoId), eq(medicos.orgId, links.orgId)),
      )
      .innerJoin(
        orgMemberships,
        and(
          eq(orgMemberships.orgId, links.orgId),
          eq(orgMemberships.userId, links.userId),
        ),
      )
      .where(
        and(
          eq(links.orgId, ctx.tenantId),
          eq(links.userId, ctx.userId),
          isNull(links.revokedAt),
          eq(medicos.status, "active"),
        ),
      )
      .limit(1);
    if (!row) return null;
    // A RLS de módulo de `pcmso_coordinator_assignments` já oculta empresas sem Medicina.
    const coordinated = await tx
      .select({
        companyId: assignments.companyId,
        razaoSocial: companies.razaoSocial,
        startsOn: assignments.startsOn,
      })
      .from(assignments)
      .innerJoin(
        companies,
        and(
          eq(companies.id, assignments.companyId),
          eq(companies.orgId, assignments.orgId),
        ),
      )
      .where(
        and(
          eq(assignments.orgId, ctx.tenantId),
          eq(assignments.medicoId, row.medicoId),
          isNull(assignments.endsOn),
        ),
      )
      .orderBy(companies.razaoSocial);
    return { ...row, coordinatedCompanies: coordinated };
  });
}

/**
 * Autorização por vínculo (NOB-121): a conta da sessão só age como coordenadora da empresa se
 * estiver vinculada ao profissional da designação ABERTA. Papel no escritório (owner,
 * colaborador) não substitui o vínculo. Usada pelas próximas etapas (revisão do plano de exames).
 */
export async function assertActorIsCompanyCoordinator(
  tx: TenantTransaction,
  ctx: TenantContext,
  companyId: string,
): Promise<{ medicoId: string; linkId: string }> {
  const [row] = await tx
    .select({ medicoId: assignments.medicoId, linkId: links.id })
    .from(assignments)
    .innerJoin(
      links,
      and(
        eq(links.orgId, assignments.orgId),
        eq(links.medicoId, assignments.medicoId),
        isNull(links.revokedAt),
      ),
    )
    .innerJoin(
      medicos,
      and(eq(medicos.id, assignments.medicoId), eq(medicos.orgId, assignments.orgId)),
    )
    .innerJoin(
      orgMemberships,
      and(eq(orgMemberships.orgId, links.orgId), eq(orgMemberships.userId, links.userId)),
    )
    .where(
      and(
        eq(assignments.orgId, ctx.tenantId),
        eq(assignments.companyId, companyId),
        isNull(assignments.endsOn),
        eq(links.userId, ctx.userId),
        eq(medicos.status, "active"),
      ),
    )
    .limit(1);
  if (!row)
    throw new ForbiddenError(
      "Somente o médico coordenador do PCMSO desta empresa, com acesso vinculado, pode executar esta ação.",
    );
  return row;
}

/** Versão autônoma (abre a própria transação com o ator) da verificação acima. */
export async function isActorCompanyCoordinator(
  ctx: TenantContext,
  companyId: string,
): Promise<boolean> {
  return actorTx(ctx, async (tx) => {
    try {
      await assertActorIsCompanyCoordinator(tx, ctx, companyId);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) return false;
      throw error;
    }
  });
}
