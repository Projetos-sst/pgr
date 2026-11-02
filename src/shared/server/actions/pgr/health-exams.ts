"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  healthExamInputSchema,
  healthExamListFiltersSchema,
  type HealthExamInput,
  type HealthExamListItem,
} from "@/shared/domains/pgr/health-exams";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/health-exams";
import type { HealthExam } from "@/shared/db/schema/health-exams";

const BASE_PATH = "/health-exams";

// Telas que exibem exames além de /health-exams: painel da Medicina e ficha do
// funcionário (ambas force-dynamic; isso só mantém o cache de navegação coerente).
function revalidateExamViews(employeeId: string): void {
  revalidatePath(BASE_PATH);
  revalidatePath("/medicine");
  revalidatePath(`/employees/${employeeId}`);
}

/** `examType` chega cru (ex.: da URL) e é validado aqui: fora do enum → VALIDATION. */
export type ListHealthExamsActionParams = Omit<repo.ListHealthExamsParams, "examType"> & {
  examType?: string;
};

export async function listHealthExamsAction(
  params: ListHealthExamsActionParams = {},
): Promise<ActionResult<Paginated<HealthExamListItem>>> {
  return officeAction("pgr.health-exams.list", async ({ tenantId }) => {
    // ID malformado ou tipo fora do enum → ZodError → VALIDATION (nunca lista
    // vazia). Os filtros são somados a org_id no repositório: ID de outro tenant →
    // lista vazia.
    const filters = healthExamListFiltersSchema.parse({
      employeeId: params.employeeId,
      companyId: params.companyId,
      examType: params.examType,
    });
    return repo.listHealthExams(tenantId, {
      ...params,
      ...filters,
      examType: filters.examType,
    });
  });
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
      revalidateExamViews(data.employeeId);
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
      revalidateExamViews(data.employeeId);
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
