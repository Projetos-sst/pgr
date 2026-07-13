"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  jobRoleRequiredTrainingInputSchema,
  type JobRoleRequiredTrainingInput,
  type TrainingStatusRow,
} from "@/shared/domains/pgr/trainings";
import * as repo from "@/shared/db/repositories/job-role-required-trainings";
import * as complianceRepo from "@/shared/db/repositories/training-compliance";
import type { JobRoleRequiredTraining } from "@/shared/db/schema";

function jobRolePath(jobRoleId: string): string {
  return `/job-roles/${jobRoleId}/edit`;
}

export async function listRequiredTrainingsAction(
  params: repo.ListRequiredTrainingsParams,
): Promise<ActionResult<repo.RequiredTrainingRow[]>> {
  return officeAction("pgr.job_role_required_trainings.list", ({ tenantId }) =>
    repo.listRequiredTrainings(tenantId, params),
  );
}

export async function addRequiredTrainingAction(
  input: JobRoleRequiredTrainingInput,
): Promise<ActionResult<JobRoleRequiredTraining>> {
  return officeAction(
    "pgr.job_role_required_trainings.add",
    async ({ tenantId }) => {
      const data = jobRoleRequiredTrainingInputSchema.parse(input);
      const link = await repo.addRequiredTraining(tenantId, data);
      revalidatePath(jobRolePath(link.jobRoleId));
      return link;
    },
    { audit: true },
  );
}

export async function removeRequiredTrainingAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.job_role_required_trainings.remove",
    async ({ tenantId }) => {
      const removed = await repo.removeRequiredTraining(tenantId, id);
      if (!removed) throw new NotFoundError();
      revalidatePath(jobRolePath(removed.jobRoleId));
      return { id };
    },
    { audit: true },
  );
}

export async function getEmployeeComplianceAction(params: {
  employeeId: string;
}): Promise<ActionResult<TrainingStatusRow[]>> {
  return officeAction("pgr.training_compliance.by_employee", ({ tenantId }) =>
    complianceRepo.getEmployeeCompliance(tenantId, params.employeeId),
  );
}

export async function listNonComplianceAction(): Promise<
  ActionResult<TrainingStatusRow[]>
> {
  return officeAction("pgr.training_compliance.non_compliant", ({ tenantId }) =>
    complianceRepo.listNonCompliance(tenantId),
  );
}
