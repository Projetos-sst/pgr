import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import type { ProfessionalRevokeValues } from "@/shared/domains/medicine/professional-links";
import { NotFoundError } from "@/shared/errors/not-found-error";

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
import { actorClinicalMedicoIdsTx } from "./clinical-actor";
import { assignmentInForceTodayTx } from "./pcmso-coordinator-in-force";

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
    // Empresas em que o profissional coordena HOJE (designação em vigor e única; NOB-109): a mesma
    // regra da permissão. A RLS de módulo de `pcmso_coordinator_assignments` já oculta empresas
    // sem Medicina.
    const candidates = await tx
      .selectDistinct({
        companyId: assignments.companyId,
        razaoSocial: companies.razaoSocial,
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
        and(eq(assignments.orgId, ctx.tenantId), eq(assignments.medicoId, row.medicoId)),
      )
      .orderBy(companies.razaoSocial);
    const coordinated: ProfessionalProfile["coordinatedCompanies"] = [];
    for (const company of candidates) {
      const inForce = await assignmentInForceTodayTx(tx, ctx.tenantId, company.companyId);
      if (inForce?.medicoId === row.medicoId)
        coordinated.push({ ...company, startsOn: inForce.startsOn });
    }
    return { ...row, coordinatedCompanies: coordinated };
  });
}

/**
 * Autorização por vínculo (NOB-121): a conta da sessão só age como coordenadora da empresa se
 * estiver vinculada ao profissional da designação EM VIGOR HOJE (America/Sao_Paulo; NOB-109),
 * não a "aberta": encerramento agendado mantém o poder até o fim, sucessor agendado só o tem a
 * partir do início, e sobreposição nega a todos. Papel no escritório (owner, colaborador) não
 * substitui o vínculo. Mesma regra de `actorCoordinatesCompany` nas policies.
 */
export async function assertActorIsCompanyCoordinator(
  tx: TenantTransaction,
  ctx: TenantContext,
  companyId: string,
): Promise<{ medicoId: string; linkId: string }> {
  // NOB-158: coordenador com identidade verificada (função central do banco), nunca o vínculo sozinho.
  const clinical = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
  const denied = () =>
    new ForbiddenError(
      "Somente o médico coordenador do PCMSO desta empresa, com acesso vinculado e identidade verificada, pode executar esta ação.",
    );
  if (clinical.length === 0) throw denied();
  // Sem designação em vigor hoje, ou com sobreposição, ninguém coordena (falha fechada).
  const inForce = await assignmentInForceTodayTx(tx, ctx.tenantId, companyId);
  if (!inForce || !clinical.includes(inForce.medicoId)) throw denied();
  const [row] = await tx
    .select({ medicoId: links.medicoId, linkId: links.id })
    .from(links)
    .where(
      and(
        eq(links.orgId, ctx.tenantId),
        eq(links.medicoId, inForce.medicoId),
        eq(links.userId, ctx.userId),
        isNull(links.revokedAt),
      ),
    )
    .limit(1);
  if (!row) throw denied();
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
