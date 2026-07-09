"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  epiStockCreateSchema,
  epiStockUpdateSchema,
  type EpiStockCreateInput,
  type EpiStockUpdateInput,
  type EpiStockDetail,
  type EpiStockListItem,
  type EpiCatalogOption,
} from "@/shared/domains/pgr/epi-stock";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-stock";
import type { EpiStock } from "@/shared/db/schema/epis";

const BASE_PATH = "/epi-stock";

export async function listEpiStockAction(
  params: repo.ListEpiStockParams = {},
): Promise<ActionResult<Paginated<EpiStockListItem>>> {
  return officeAction("epi.epi_stock.list", ({ tenantId }) =>
    repo.listEpiStock(tenantId, params),
  );
}

export async function getEpiStockAction(
  id: string,
): Promise<ActionResult<EpiStockDetail>> {
  return officeAction("epi.epi_stock.get", async ({ tenantId }) => {
    const found = await repo.getEpiStockById(tenantId, id);
    if (!found) throw new NotFoundError();
    return found;
  });
}

export async function createEpiStockAction(
  input: EpiStockCreateInput,
): Promise<ActionResult<EpiStock>> {
  return officeAction(
    "epi.epi_stock.create",
    async ({ tenantId }) => {
      const data = epiStockCreateSchema.parse(input);
      const row = await repo.createEpiStock(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateEpiStockAction(
  id: string,
  input: EpiStockUpdateInput,
): Promise<ActionResult<EpiStock>> {
  return officeAction(
    "epi.epi_stock.update",
    async ({ tenantId }) => {
      const data = epiStockUpdateSchema.parse(input);
      const row = await repo.updateEpiStock(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteEpiStockAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "epi.epi_stock.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteEpiStock(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getEpiStockDependentsAction(
  id: string,
): Promise<ActionResult<{ movements: number }>> {
  return officeAction("epi.epi_stock.dependents", ({ tenantId }) =>
    repo.countEpiStockDependents(tenantId, id),
  );
}

export async function listAvailableCatalogOptionsAction(): Promise<
  ActionResult<EpiCatalogOption[]>
> {
  return officeAction("epi.epi_stock.catalog_options", ({ tenantId }) =>
    repo.listAvailableCatalogOptions(tenantId),
  );
}
