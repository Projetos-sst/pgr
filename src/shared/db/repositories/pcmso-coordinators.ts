import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  assessCoordinatorEligibility,
  planCoordinatorSwitch,
  SWITCH_END_REASON,
  type CoordinatorClosingValues,
  type CoordinatorDesignationValues,
} from "@/shared/domains/medicine/pcmso-coordinators";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import {
  medicos,
  pcmsoCoordinatorAssignments as assignments,
  type PcmsoCoordinatorAssignment,
} from "../schema/medicos";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";

export type CoordinatorAssignmentRow = PcmsoCoordinatorAssignment & {
  medicoName: string;
  medicoCrm: string;
  medicoRegistrationUf: string | null;
  medicoRqe: string | null;
  medicoAffiliation: "internal" | "external";
};

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
      "Somente o responsável pelo escritório pode designar ou encerrar o coordenador do PCMSO.",
    );
}

async function assertCompany(tx: TenantTransaction, orgId: string, companyId: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!company) throw new NotFoundError();
  await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
}

const rowSelection = {
  assignment: assignments,
  medicoName: medicos.name,
  medicoCrm: medicos.crm,
  medicoRegistrationUf: medicos.registrationUf,
  medicoRqe: medicos.rqe,
  medicoAffiliation: medicos.affiliation,
};

function flatten(r: {
  assignment: PcmsoCoordinatorAssignment;
  medicoName: string;
  medicoCrm: string;
  medicoRegistrationUf: string | null;
  medicoRqe: string | null;
  medicoAffiliation: "internal" | "external";
}): CoordinatorAssignmentRow {
  const { assignment, ...medico } = r;
  return { ...assignment, ...medico };
}

async function historyTx(tx: TenantTransaction, orgId: string, companyId: string) {
  const rows = await tx
    .select(rowSelection)
    .from(assignments)
    .innerJoin(
      medicos,
      and(eq(medicos.id, assignments.medicoId), eq(medicos.orgId, assignments.orgId)),
    )
    .where(and(eq(assignments.orgId, orgId), eq(assignments.companyId, companyId)))
    .orderBy(desc(assignments.startsOn));
  return rows.map(flatten);
}

/** Histórico completo de coordenadores da empresa, do mais recente ao mais antigo. */
export async function listCoordinatorAssignments(
  ctx: TenantContext,
  companyId: string,
): Promise<CoordinatorAssignmentRow[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    return historyTx(tx, ctx.tenantId, companyId);
  });
}

export async function getCoordinatorAssignment(
  ctx: TenantContext,
  id: string,
): Promise<CoordinatorAssignmentRow> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select(rowSelection)
      .from(assignments)
      .innerJoin(
        medicos,
        and(eq(medicos.id, assignments.medicoId), eq(medicos.orgId, assignments.orgId)),
      )
      .where(and(eq(assignments.orgId, ctx.tenantId), eq(assignments.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    return flatten(row);
  });
}

/**
 * Designa o coordenador. Se houver designação aberta, ela é encerrada na
 * véspera do início da nova, na mesma transação (troca rastreável).
 */
export async function designateCoordinator(
  ctx: TenantContext,
  companyId: string,
  input: CoordinatorDesignationValues,
): Promise<PcmsoCoordinatorAssignment> {
  assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.pcmso_coordinators.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        await assertCompany(tx, ctx.tenantId, companyId);
        const [medico] = await tx
          .select()
          .from(medicos)
          .where(and(eq(medicos.orgId, ctx.tenantId), eq(medicos.id, input.medicoId)))
          .limit(1);
        if (!medico) throw new ValidationError("Médico não encontrado neste escritório.");
        const eligibility = assessCoordinatorEligibility(
          medico,
          input.rqeExceptionReason,
        );
        if (!eligibility.ok) throw new ValidationError(eligibility.message);

        const history = await tx
          .select({
            id: assignments.id,
            startsOn: assignments.startsOn,
            endsOn: assignments.endsOn,
          })
          .from(assignments)
          .where(
            and(
              eq(assignments.orgId, ctx.tenantId),
              eq(assignments.companyId, companyId),
            ),
          );
        const plan = planCoordinatorSwitch(history, input.startsOn);
        if (!plan.ok) throw new ValidationError(plan.message);

        if (plan.closeOpenOn) {
          await tx
            .update(assignments)
            .set({
              endsOn: plan.closeOpenOn,
              endReason: SWITCH_END_REASON,
              endedBy: ctx.userId,
            })
            .where(
              and(
                eq(assignments.orgId, ctx.tenantId),
                eq(assignments.companyId, companyId),
                isNull(assignments.endsOn),
              ),
            );
        }
        // Concorrência: o índice único parcial (uma designação aberta por empresa) barra
        // a segunda inserção simultânea (23505 → DUPLICATE).
        const [created] = await tx
          .insert(assignments)
          .values({
            orgId: ctx.tenantId,
            companyId,
            medicoId: medico.id,
            startsOn: input.startsOn,
            rqeExceptionReason: eligibility.rqeExceptionReason,
            createdBy: ctx.userId,
          })
          .returning();
        return created;
      }),
  );
}

/** Encerra a designação aberta sem nomear substituto (a empresa fica sem coordenador). */
export async function closeCoordinatorAssignment(
  ctx: TenantContext,
  id: string,
  input: CoordinatorClosingValues,
): Promise<PcmsoCoordinatorAssignment> {
  assertOwner(ctx);
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.pcmso_coordinators.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const [current] = await tx
          .select()
          .from(assignments)
          .where(and(eq(assignments.orgId, ctx.tenantId), eq(assignments.id, id)))
          .limit(1);
        if (!current) throw new NotFoundError();
        await assertCompany(tx, ctx.tenantId, current.companyId);
        if (current.endsOn !== null)
          throw new ValidationError(
            "Esta designação já foi encerrada e não pode ser alterada.",
          );
        if (input.endsOn < current.startsOn)
          throw new ValidationError(
            `A data de encerramento não pode ser anterior ao início (${current.startsOn}).`,
          );
        const [closed] = await tx
          .update(assignments)
          .set({ endsOn: input.endsOn, endReason: input.endReason, endedBy: ctx.userId })
          .where(and(eq(assignments.orgId, ctx.tenantId), eq(assignments.id, id)))
          .returning();
        return closed;
      }),
  );
}
