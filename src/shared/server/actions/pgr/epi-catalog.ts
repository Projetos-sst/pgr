"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  epiCatalogInputSchema,
  type EpiCatalogInput,
  type EpiCatalogListItem,
} from "@/shared/domains/pgr/epi-catalog";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-catalog";
import type { EpiCatalog } from "@/shared/db/schema/epis";

const BASE_PATH = "/epi-catalog";

export async function listEpiCatalogAction(
  params: repo.ListEpiCatalogParams = {},
): Promise<ActionResult<Paginated<EpiCatalogListItem>>> {
  return officeAction("pgr.epi_catalog.list", ({ tenantId }) =>
    repo.listEpiCatalog(tenantId, params),
  );
}

export async function getEpiCatalogAction(id: string): Promise<ActionResult<EpiCatalog>> {
  return officeAction("pgr.epi_catalog.get", async ({ tenantId }) => {
    const row = await repo.getEpiCatalogById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createEpiCatalogAction(
  input: EpiCatalogInput,
): Promise<ActionResult<EpiCatalog>> {
  return officeAction(
    "pgr.epi_catalog.create",
    async ({ tenantId }) => {
      const data = epiCatalogInputSchema.parse(input);
      const row = await repo.createEpiCatalog(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateEpiCatalogAction(
  id: string,
  input: EpiCatalogInput,
): Promise<ActionResult<EpiCatalog>> {
  return officeAction(
    "pgr.epi_catalog.update",
    async ({ tenantId }) => {
      const data = epiCatalogInputSchema.parse(input);
      const row = await repo.updateEpiCatalog(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteEpiCatalogAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.epi_catalog.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteEpiCatalog(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getEpiCatalogDependentsAction(
  id: string,
): Promise<ActionResult<repo.EpiCatalogDependents>> {
  return officeAction("pgr.epi_catalog.dependents", ({ tenantId }) =>
    repo.countEpiCatalogDependents(tenantId, id),
  );
}
