"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  healthExamInputSchema,
  type HealthExamInput,
  type HealthExamListItem,
} from "@/shared/domains/pgr/health-exams";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/health-exams";
import type { HealthExam } from "@/shared/db/schema/health-exams";

const BASE_PATH = "/health-exams";

export async function listHealthExamsAction(
  params: repo.ListHealthExamsParams = {},
): Promise<ActionResult<Paginated<HealthExamListItem>>> {
  return officeAction("pgr.health-exams.list", ({ tenantId }) =>
    repo.listHealthExams(tenantId, params),
  );
}

export async function getHealthExamAction(id: string): Promise<ActionResult<HealthExam>> {
  return officeAction("pgr.health-exams.get", async ({ tenantId }) => {
    const exam = await repo.getHealthExamById(tenantId, id);
    if (!exam) throw new NotFoundError();
    return exam;
  });
}

export async function createHealthExamAction(
  input: HealthExamInput,
): Promise<ActionResult<HealthExam>> {
  return officeAction(
    "pgr.health-exams.create",
    async ({ tenantId }) => {
      const data = healthExamInputSchema.parse(input);
      const exam = await repo.createHealthExam(tenantId, data);
      revalidatePath(BASE_PATH);
      return exam;
    },
    { audit: true },
  );
}

export async function updateHealthExamAction(
  id: string,
  input: HealthExamInput,
): Promise<ActionResult<HealthExam>> {
  return officeAction(
    "pgr.health-exams.update",
    async ({ tenantId }) => {
      const data = healthExamInputSchema.parse(input);
      const exam = await repo.updateHealthExam(tenantId, id, data);
      if (!exam) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return exam;
    },
    { audit: true },
  );
}

export async function deleteHealthExamAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.health-exams.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteHealthExam(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
