"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  trainingRecordInputSchema,
  type TrainingRecordInput,
} from "@/shared/domains/pgr/trainings";
import type {
  TrainingDueSummary,
  TrainingStatusRow,
} from "@/shared/domains/pgr/trainings";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/training-records";
import * as complianceRepo from "@/shared/db/repositories/training-compliance";
import type { TrainingRecord } from "@/shared/db/schema";

function employeePath(employeeId: string): string {
  return `/employees/${employeeId}`;
}

export async function listTrainingRecordsAction(
  params: repo.ListTrainingRecordsParams,
): Promise<ActionResult<Paginated<repo.TrainingRecordRow>>> {
  return officeAction("pgr.training_records.list", ({ tenantId }) =>
    repo.listTrainingRecordsByEmployee(tenantId, params),
  );
}

export async function getTrainingRecordAction(
  id: string,
): Promise<ActionResult<TrainingRecord>> {
  return officeAction("pgr.training_records.get", async ({ tenantId }) => {
    const record = await repo.getTrainingRecordById(tenantId, id);
    if (!record) throw new NotFoundError();
    return record;
  });
}

export async function createTrainingRecordAction(
  input: TrainingRecordInput,
): Promise<ActionResult<TrainingRecord>> {
  return officeAction(
    "pgr.training_records.create",
    async ({ tenantId }) => {
      const data = trainingRecordInputSchema.parse(input);
      const record = await repo.createTrainingRecord(tenantId, data);
      revalidatePath(employeePath(record.employeeId));
      return record;
    },
    { audit: true },
  );
}

export async function listTrainingExpiryAction(
  params: complianceRepo.ListTrainingExpiryParams,
): Promise<ActionResult<TrainingStatusRow[]>> {
  return officeAction("pgr.training_records.expiry", ({ tenantId }) =>
    complianceRepo.listTrainingExpiry(tenantId, params),
  );
}

export async function getTrainingDueSummaryAction(): Promise<
  ActionResult<TrainingDueSummary>
> {
  return officeAction("pgr.training_records.due_summary", ({ tenantId }) =>
    complianceRepo.getTrainingDueSummary(tenantId),
  );
}

export async function deleteTrainingRecordAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.training_records.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteTrainingRecord(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(employeePath(deleted.employeeId));
      return { id };
    },
    { audit: true },
  );
}
