import "server-only";

import { and, desc, eq, max, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { InterpretationCriteriaValues } from "@/shared/domains/medicine/interpretation-criteria";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { medicos } from "../schema/medicos";
import {
  pcmsoInterpretationCriteria as criteria,
  type PcmsoInterpretationCriterion,
} from "../schema/pcmso-interpretation-criteria";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { assertActorIsCompanyCoordinator } from "./medico-user-links";

export type CriterionRow = PcmsoInterpretationCriterion & { authorName: string | null };

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
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

const row = {
  id: criteria.id,
  orgId: criteria.orgId,
  companyId: criteria.companyId,
  procedureCode: criteria.procedureCode,
  otherDescription: criteria.otherDescription,
  version: criteria.version,
  criteria: criteria.criteria,
  conduct: criteria.conduct,
  authoredByMedicoId: criteria.authoredByMedicoId,
  authoredByUser: criteria.authoredByUser,
  authoredAt: criteria.authoredAt,
  authorName: medicos.name,
};

const withAuthor = and(
  eq(medicos.id, criteria.authoredByMedicoId),
  eq(medicos.orgId, criteria.orgId),
);

/** Versão vigente (a mais recente) de cada procedimento da empresa. */
export async function listCurrentCriteria(
  ctx: TenantContext,
  companyId: string,
): Promise<CriterionRow[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    return tx
      .selectDistinctOn([criteria.procedureCode, criteria.otherDescription], row)
      .from(criteria)
      .leftJoin(medicos, withAuthor)
      .where(and(eq(criteria.orgId, ctx.tenantId), eq(criteria.companyId, companyId)))
      .orderBy(criteria.procedureCode, criteria.otherDescription, desc(criteria.version));
  });
}

/** Todas as versões da empresa, da mais recente à mais antiga (histórico). */
export async function listCriteriaHistory(
  ctx: TenantContext,
  companyId: string,
  code: string,
): Promise<CriterionRow[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    return tx
      .select(row)
      .from(criteria)
      .leftJoin(medicos, withAuthor)
      .where(
        and(
          eq(criteria.orgId, ctx.tenantId),
          eq(criteria.companyId, companyId),
          eq(criteria.procedureCode, code),
        ),
      )
      .orderBy(criteria.otherDescription, desc(criteria.version));
  });
}

/**
 * Nova versão do critério de um procedimento. Só a conta vinculada ao coordenador com designação
 * em vigor hoje (NOB-149/NOB-109), em nome desse médico; a RLS repete a regra.
 */
export async function insertCriterion(
  ctx: TenantContext,
  companyId: string,
  input: InterpretationCriteriaValues,
): Promise<PcmsoInterpretationCriterion> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.interpretation_criteria.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        await assertCompany(tx, ctx.tenantId, companyId);
        const { medicoId } = await assertActorIsCompanyCoordinator(tx, ctx, companyId);
        const other = input.otherDescription ?? null;
        const [{ last }] = await tx
          .select({ last: max(criteria.version) })
          .from(criteria)
          .where(
            and(
              eq(criteria.orgId, ctx.tenantId),
              eq(criteria.companyId, companyId),
              eq(criteria.procedureCode, input.code),
              other === null
                ? sql`${criteria.otherDescription} is null`
                : eq(criteria.otherDescription, other),
            ),
          );
        const [created] = await tx
          .insert(criteria)
          .values({
            orgId: ctx.tenantId,
            companyId,
            procedureCode: input.code,
            otherDescription: other,
            version: (last ?? 0) + 1,
            criteria: input.criteria,
            conduct: input.conduct,
            authoredByMedicoId: medicoId,
            authoredByUser: ctx.userId,
          })
          .returning();
        return created;
      }),
  );
}
