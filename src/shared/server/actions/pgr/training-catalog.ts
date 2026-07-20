"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  trainingCatalogInputSchema,
  type TrainingCatalogInput,
} from "@/shared/domains/pgr/trainings";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/training-catalog";
import type { TrainingCatalog } from "@/shared/db/schema";

const BASE_PATH = "/training-catalog";

export async function listTrainingCatalogAction(
  params: repo.ListTrainingCatalogParams = {},
): Promise<ActionResult<Paginated<TrainingCatalog>>> {
  return officeAction("pgr.training_catalog.list", ({ tenantId }) =>
    repo.listTrainingCatalog(tenantId, params),
  );
}

export async function listTrainingCatalogOptionsAction(): Promise<
  ActionResult<repo.TrainingCatalogOption[]>
> {
  return officeAction("pgr.training_catalog.options", ({ tenantId }) =>
    repo.listTrainingCatalogOptions(tenantId),
  );
}

export async function getTrainingCatalogAction(
  id: string,
): Promise<ActionResult<TrainingCatalog>> {
  return officeAction("pgr.training_catalog.get", async ({ tenantId }) => {
    const item = await repo.getTrainingCatalogById(tenantId, id);
    if (!item) throw new NotFoundError();
    return item;
  });
}

export async function createTrainingCatalogAction(
  input: TrainingCatalogInput,
): Promise<ActionResult<TrainingCatalog>> {
  return officeAction(
    "pgr.training_catalog.create",
    async ({ tenantId }) => {
      const data = trainingCatalogInputSchema.parse(input);
      const item = await repo.createTrainingCatalog(tenantId, data);
      revalidatePath(BASE_PATH);
      return item;
    },
    { audit: true },
  );
}

export async function updateTrainingCatalogAction(
  id: string,
  input: TrainingCatalogInput,
): Promise<ActionResult<TrainingCatalog>> {
  return officeAction(
    "pgr.training_catalog.update",
    async ({ tenantId }) => {
      const data = trainingCatalogInputSchema.parse(input);
      const item = await repo.updateTrainingCatalog(tenantId, id, data);
      if (!item) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return item;
    },
    { audit: true },
  );
}

export async function deleteTrainingCatalogAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.training_catalog.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteTrainingCatalog(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getTrainingCatalogDependentsAction(
  id: string,
): Promise<ActionResult<repo.TrainingCatalogDependents>> {
  return officeAction("pgr.training_catalog.dependents", async ({ tenantId }) => {
    const item = await repo.getTrainingCatalogById(tenantId, id);
    if (!item) throw new NotFoundError();
    return repo.countTrainingCatalogDependents(tenantId, id);
  });
}
