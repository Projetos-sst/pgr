"use server";

import { revalidatePath } from "next/cache";

import { listInspectionPlans, listVehicles } from "@/shared/db/repositories/inspections";
import * as repo from "@/shared/db/repositories/vehicular-inspections";
import { PAGE_SIZE_MAX } from "@/shared/pagination";
import {
  checklistSchema,
  vehicularInspectionHeaderSchema,
  type ChecklistInput,
  type VehicularInspectionDetail,
  type VehicularInspectionHeaderInput,
  type VehicularInspectionListItem,
} from "@/shared/domains/inspections/vehicular-inspections";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/inspecoes-veiculares";

export type HeaderOption = { value: string; label: string };

// Opções dos selects do cabeçalho (veículo + plano veicular). Limitado a
// PAGE_SIZE_MAX — autocomplete server-side fica para uma fatia futura.
export async function getVehicularHeaderOptionsAction(): Promise<
  ActionResult<{ vehicles: HeaderOption[]; plans: HeaderOption[] }>
> {
  return officeAction("inspections.vehicular.options", async ({ tenantId }) => {
    const [vehiclesPage, plansPage] = await Promise.all([
      listVehicles(tenantId, { pageSize: PAGE_SIZE_MAX }),
      listInspectionPlans(tenantId, { pageSize: PAGE_SIZE_MAX }),
    ]);
    return {
      vehicles: vehiclesPage.rows.map((v) => ({
        value: v.id,
        label:
          v.brand || v.model
            ? `${v.plate} — ${[v.brand, v.model].filter(Boolean).join(" ")}`
            : v.plate,
      })),
      plans: plansPage.rows
        .filter((p) => p.type === "vehicular")
        .map((p) => ({ value: p.id, label: p.title })),
    };
  });
}

export async function listVehicularInspectionsAction(
  params: repo.ListVehicularInspectionsParams = {},
): Promise<ActionResult<Paginated<VehicularInspectionListItem>>> {
  return officeAction("inspections.vehicular.list", ({ tenantId }) =>
    repo.listVehicularInspections(tenantId, params),
  );
}

export async function getVehicularInspectionAction(
  id: string,
): Promise<ActionResult<VehicularInspectionDetail>> {
  return officeAction("inspections.vehicular.get", async ({ tenantId }) => {
    const row = await repo.getVehicularInspection(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createVehicularInspectionAction(
  input: VehicularInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.vehicular.create",
    async ({ tenantId }) => {
      const result = await repo.createVehicularInspection(
        tenantId,
        vehicularInspectionHeaderSchema.parse(input),
      );
      if (!result) throw new ReferenceNotFoundError();
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateVehicularInspectionHeaderAction(
  id: string,
  input: VehicularInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.vehicular.update",
    async ({ tenantId }) => {
      const ok = await repo.updateVehicularInspectionHeader(
        tenantId,
        id,
        vehicularInspectionHeaderSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function saveChecklistAction(
  id: string,
  input: ChecklistInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.vehicular.checklist",
    async ({ tenantId }) => {
      const ok = await repo.saveChecklist(tenantId, id, checklistSchema.parse(input));
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteVehicularInspectionAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "inspections.vehicular.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteVehicularInspection(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}
