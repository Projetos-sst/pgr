"use server";

import { revalidatePath } from "next/cache";

import type { Vehicle } from "@/shared/db/schema";
import * as repo from "@/shared/db/repositories/vehicles";
import {
  vehicleInputSchema,
  type VehicleInput,
  type VehicleListItem,
} from "@/shared/domains/inspections/vehicles";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export async function listVehiclesAction(
  params: repo.ListVehiclesParams = {},
): Promise<ActionResult<Paginated<VehicleListItem>>> {
  return officeAction("inspections.vehicles.list", ({ tenantId }) =>
    repo.listVehiclesPaginated(tenantId, params),
  );
}

export async function getVehicleAction(id: string): Promise<ActionResult<Vehicle>> {
  return officeAction("inspections.vehicles.get", async ({ tenantId }) => {
    const row = await repo.getVehicle(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createVehicleAction(
  input: VehicleInput,
): Promise<ActionResult<Vehicle>> {
  return officeAction(
    "inspections.vehicles.create",
    async ({ tenantId }) => {
      const row = await repo.createVehicle(tenantId, vehicleInputSchema.parse(input));
      revalidatePath("/vehicles");
      return row;
    },
    { audit: true },
  );
}

export async function updateVehicleAction(
  id: string,
  input: VehicleInput,
): Promise<ActionResult<Vehicle>> {
  return officeAction(
    "inspections.vehicles.update",
    async ({ tenantId }) => {
      const row = await repo.updateVehicle(tenantId, id, vehicleInputSchema.parse(input));
      if (!row) throw new NotFoundError();
      revalidatePath("/vehicles");
      return row;
    },
    { audit: true },
  );
}

export async function deleteVehicleAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "inspections.vehicles.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteVehicle(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath("/vehicles");
      return { deleted: true as const };
    },
    { audit: true },
  );
}
