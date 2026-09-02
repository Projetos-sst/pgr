"use server";

import { revalidatePath } from "next/cache";

import type { Vehicle } from "@/shared/db/schema";
import * as repo from "@/shared/db/repositories/vehicles";
import { listCompanies } from "@/shared/db/repositories/companies";
import { listWorkUnits } from "@/shared/db/repositories/work-units";
import { listPlans } from "@/shared/db/repositories/inspection-plans";
import {
  vehicleFiltersSchema,
  vehicleInputSchema,
  type VehicleFilters,
  type VehicleInput,
  type VehicleListItem,
} from "@/shared/domains/inspections/vehicles";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export type VehicleOption = { value: string; label: string };

/** Opções de empresa para o campo Empresa + filtro da lista. */
export async function listVehicleCompanyOptionsAction(): Promise<
  ActionResult<VehicleOption[]>
> {
  return officeAction("inspections.vehicles.company_options", async ({ tenantId }) => {
    const { rows } = await listCompanies(tenantId, { pageSize: 100 });
    return rows.map((c) => ({ value: c.id, label: c.razaoSocial }));
  });
}

/** Opções de unidade/obra para o campo Unidade / Obra. */
export async function listVehicleWorkUnitOptionsAction(): Promise<
  ActionResult<VehicleOption[]>
> {
  return officeAction("inspections.vehicles.work_unit_options", async ({ tenantId }) => {
    const { rows } = await listWorkUnits(tenantId, { pageSize: 100 });
    return rows.map((u) => ({
      value: u.id,
      label: u.companyName ? `${u.name} · ${u.companyName}` : u.name,
    }));
  });
}

/** Opções de plano de inspeção (apenas veiculares) para o campo Plano de inspeção. */
export async function listVehicleInspectionPlanOptionsAction(): Promise<
  ActionResult<VehicleOption[]>
> {
  return officeAction("inspections.vehicles.plan_options", async ({ tenantId }) => {
    const { rows } = await listPlans(tenantId, { type: "vehicular", pageSize: 100 });
    return rows.map((p) => ({ value: p.id, label: p.title }));
  });
}

export async function listVehiclesAction(
  params: VehicleFilters = {},
): Promise<ActionResult<Paginated<VehicleListItem>>> {
  return officeAction("inspections.vehicles.list", ({ tenantId }) =>
    repo.listVehiclesPaginated(tenantId, vehicleFiltersSchema.parse(params)),
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
