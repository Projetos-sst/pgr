import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type {
  JobRoleRequiredTrainingValues,
  RequiredTrainingRow,
} from "@/shared/domains/pgr/trainings";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  jobRoleRequiredTrainings,
  jobRoles,
  trainingCatalog,
  type JobRoleRequiredTraining,
} from "../schema";
import { auditedTenantWrite } from "./audited-write";

export type ListRequiredTrainingsParams = { jobRoleId: string };

export type { RequiredTrainingRow };

const AUDIT_OP = "pgr.job_role_required_trainings.write_rejected";

async function assertJobRoleInTenant(
  tx: TenantTransaction,
  orgId: string,
  jobRoleId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, jobRoleId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("jobRole");
}

async function assertTrainingInTenant(
  tx: TenantTransaction,
  orgId: string,
  trainingId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: trainingCatalog.id })
    .from(trainingCatalog)
    .where(and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, trainingId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("training");
}

export async function listRequiredTrainings(
  orgId: string,
  params: ListRequiredTrainingsParams,
): Promise<RequiredTrainingRow[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: jobRoleRequiredTrainings.id,
        jobRoleId: jobRoleRequiredTrainings.jobRoleId,
        trainingId: jobRoleRequiredTrainings.trainingId,
        trainingName: trainingCatalog.name,
        periodicity: trainingCatalog.periodicity,
      })
      .from(jobRoleRequiredTrainings)
      .innerJoin(
        trainingCatalog,
        and(
          eq(trainingCatalog.id, jobRoleRequiredTrainings.trainingId),
          eq(trainingCatalog.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(jobRoleRequiredTrainings.orgId, orgId),
          eq(jobRoleRequiredTrainings.jobRoleId, params.jobRoleId),
        ),
      )
      .orderBy(asc(trainingCatalog.name)),
  );
}

/**
 * Vincula um treinamento como obrigatório para a função. IDEMPOTENTE: o UNIQUE
 * `(org_id, job_role_id, training_id)` garante 1 vínculo por par; repetir o add
 * devolve o vínculo existente (sem erro). FKs validadas DENTRO do tenant
 * (cross-tenant → FK_NOT_FOUND; a FK do banco não enxerga `org_id`).
 */
export async function addRequiredTraining(
  orgId: string,
  input: JobRoleRequiredTrainingValues,
): Promise<JobRoleRequiredTraining> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertJobRoleInTenant(tx, orgId, input.jobRoleId);
      await assertTrainingInTenant(tx, orgId, input.trainingId);

      const [inserted] = await tx
        .insert(jobRoleRequiredTrainings)
        .values({ orgId, jobRoleId: input.jobRoleId, trainingId: input.trainingId })
        .onConflictDoNothing()
        .returning();
      if (inserted) return inserted;

      const [existing] = await tx
        .select()
        .from(jobRoleRequiredTrainings)
        .where(
          and(
            eq(jobRoleRequiredTrainings.orgId, orgId),
            eq(jobRoleRequiredTrainings.jobRoleId, input.jobRoleId),
            eq(jobRoleRequiredTrainings.trainingId, input.trainingId),
          ),
        )
        .limit(1);
      return existing;
    }),
  );
}

export async function removeRequiredTraining(
  orgId: string,
  id: string,
): Promise<JobRoleRequiredTraining | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .delete(jobRoleRequiredTrainings)
        .where(
          and(
            eq(jobRoleRequiredTrainings.orgId, orgId),
            eq(jobRoleRequiredTrainings.id, id),
          ),
        )
        .returning();
      return row ?? null;
    }),
  );
}
