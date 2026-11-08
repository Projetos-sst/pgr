import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import type { RiskAbsenceDeclarationView } from "@/shared/domains/medicine/risk-absence";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { jobRoles } from "../schema/job-roles";
import { professionalRiskAuthorizations as grants } from "../schema/medical-risk-authorizations";
import { medicalRiskAbsenceDeclarations as declarations } from "../schema/medical-risk-absence";
import { orgMemberships } from "../schema/org-memberships";
import { auditedTenantWrite } from "./audited-write";
import { assertCompanyModuleTx } from "./company-modules";

/** Transação com o ator da sessão: a policy de inclusão confere a autorização ativa. */
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code: unknown }).code === "23505") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Declarações da empresa (todas as fontes), da mais recente à mais antiga. */
export async function listRiskAbsenceDeclarations(
  ctx: TenantContext,
  companyId: string,
): Promise<RiskAbsenceDeclarationView[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompanyModuleTx(tx, ctx.tenantId, companyId, "medicine");
    const rows = await tx
      .select({
        id: declarations.id,
        sourceId: declarations.sourceId,
        gesId: declarations.gesId,
        exposureGroup: declarations.exposureGroup,
        jobRole: declarations.jobRole,
        jobRoleId: declarations.jobRoleId,
        currentJobRole: jobRoles.title,
        justification: declarations.justification,
        declaredBy: declarations.declaredBy,
        identity: grants.identity,
        declaredAt: declarations.declaredAt,
      })
      .from(declarations)
      .leftJoin(
        grants,
        and(
          eq(grants.orgId, declarations.orgId),
          eq(grants.companyId, declarations.companyId),
          eq(grants.userId, declarations.declaredBy),
        ),
      )
      // Título atual da função declarada (pode ter sido renomeada depois da declaração).
      .leftJoin(
        jobRoles,
        and(
          eq(jobRoles.id, declarations.jobRoleId),
          eq(jobRoles.orgId, declarations.orgId),
          eq(jobRoles.companyId, declarations.companyId),
        ),
      )
      .where(
        and(eq(declarations.orgId, ctx.tenantId), eq(declarations.companyId, companyId)),
      )
      .orderBy(desc(declarations.declaredAt), desc(declarations.id));
    return rows.map(({ identity, declaredAt, ...row }) => ({
      ...row,
      declaredByName: identity?.fullName ?? null,
      declaredAt: declaredAt.toISOString(),
    }));
  });
}

/** O ator tem autorização profissional ativa para validar os riscos desta empresa (NOB-98)? */
async function hasActiveGrantTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  companyId: string,
) {
  const [row] = await tx
    .select({ id: grants.id })
    .from(grants)
    .innerJoin(
      orgMemberships,
      and(
        eq(orgMemberships.orgId, grants.orgId),
        eq(orgMemberships.userId, grants.userId),
      ),
    )
    .where(
      and(
        eq(grants.orgId, ctx.tenantId),
        eq(grants.companyId, companyId),
        eq(grants.userId, ctx.userId),
        eq(grants.active, true),
        sql`(${orgMemberships.scopedCompanyId} is null or ${orgMemberships.scopedCompanyId} = ${companyId})`,
      ),
    )
    .limit(1);
  return !!row;
}

export async function canDeclareRiskAbsence(
  ctx: TenantContext,
  companyId: string,
): Promise<boolean> {
  return actorTx(ctx, (tx) => hasActiveGrantTx(tx, ctx, companyId));
}

/** GES da empresa, para o formulário da declaração (só id e nome). */
export async function listCompanyGes(
  ctx: TenantContext,
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  return withOrg(ctx.tenantId, (tx) =>
    tx
      .select({ id: ges.id, name: ges.name })
      .from(ges)
      .where(and(eq(ges.orgId, ctx.tenantId), eq(ges.companyId, companyId)))
      .orderBy(ges.name),
  );
}

/**
 * Funções cadastradas vinculadas a cada GES da empresa (`ges_job_roles`), para a declaração
 * escolher a função em vez de digitar (NOB-112). Só GES e funções desta empresa, neste tenant.
 * Com `gesId`, só as daquele GES.
 */
export async function listCompanyGesJobRoles(
  ctx: TenantContext,
  companyId: string,
  gesId?: string,
): Promise<{ gesId: string; jobRoleId: string; title: string }[]> {
  return withOrg(ctx.tenantId, (tx) =>
    tx
      .select({
        gesId: gesJobRoles.gesId,
        jobRoleId: jobRoles.id,
        title: jobRoles.title,
      })
      .from(gesJobRoles)
      .innerJoin(
        ges,
        and(eq(ges.id, gesJobRoles.gesId), eq(ges.orgId, gesJobRoles.orgId)),
      )
      .innerJoin(
        jobRoles,
        and(
          eq(jobRoles.id, gesJobRoles.jobRoleId),
          eq(jobRoles.orgId, gesJobRoles.orgId),
        ),
      )
      .where(
        and(
          eq(gesJobRoles.orgId, ctx.tenantId),
          eq(ges.companyId, companyId),
          eq(jobRoles.companyId, companyId),
          gesId ? eq(gesJobRoles.gesId, gesId) : undefined,
        ),
      )
      .orderBy(jobRoles.title),
  );
}

/** GES da empresa (proveniência do nome do grupo na declaração). Outro GES → 404. */
export async function getCompanyGes(
  ctx: TenantContext,
  companyId: string,
  gesId: string,
): Promise<{ id: string; name: string }> {
  return withOrg(ctx.tenantId, async (tx) => {
    const [row] = await tx
      .select({ id: ges.id, name: ges.name })
      .from(ges)
      .where(
        and(eq(ges.orgId, ctx.tenantId), eq(ges.companyId, companyId), eq(ges.id, gesId)),
      )
      .limit(1);
    if (!row) throw new NotFoundError();
    return row;
  });
}

/** Declaração já conferida por quem chama: função resolvida (id + título atual) ou grupo todo. */
export type RiskAbsenceInsert = {
  sourceId: string;
  gesId: string;
  jobRoleId: string | null;
  jobRole: string;
  justification: string;
};

/**
 * Grava a declaração. Quem chama já conferiu a fonte vigente, a ausência de riscos no escopo
 * (`declarationBlocker`) e que a função está vinculada ao GES; aqui ficam a autorização
 * (servidor + RLS), a função presa ao id com o título do momento (FK + policy) e a unicidade.
 */
export async function insertRiskAbsenceDeclaration(
  ctx: TenantContext,
  companyId: string,
  input: RiskAbsenceInsert,
  exposureGroup: string,
): Promise<{ id: string }> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.risk_absence.write_rejected",
    async () => {
      try {
        return await actorTx(ctx, async (tx) => {
          await assertCompanyModuleTx(tx, ctx.tenantId, companyId, "medicine");
          if (!(await hasActiveGrantTx(tx, ctx, companyId)))
            throw new ForbiddenError(
              "A declaração de inexistência de riscos exige autorização profissional ativa de validação de riscos nesta empresa.",
            );
          const [row] = await tx
            .insert(declarations)
            .values({
              orgId: ctx.tenantId,
              companyId,
              sourceId: input.sourceId,
              gesId: input.gesId,
              exposureGroup,
              jobRole: input.jobRole,
              jobRoleId: input.jobRoleId,
              justification: input.justification,
              declaredBy: ctx.userId,
            })
            .returning({ id: declarations.id });
          return row;
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new ValidationError(
            "Já existe declaração para este grupo e função nesta versão da fonte.",
          );
        throw error;
      }
    },
  );
}
