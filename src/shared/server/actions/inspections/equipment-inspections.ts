"use server";

import { revalidatePath } from "next/cache";

import { listEpiCatalog } from "@/shared/db/repositories/epi-catalog";
import { listInspectionPlans } from "@/shared/db/repositories/inspections";
import * as repo from "@/shared/db/repositories/equipment-inspections";
import {
  checklistSchema,
  equipmentInspectionHeaderSchema,
  type ChecklistInput,
  type EquipmentInspectionDetail,
  type EquipmentInspectionHeaderInput,
  type EquipmentInspectionListItem,
} from "@/shared/domains/inspections/equipment-inspections";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { PAGE_SIZE_MAX, type Paginated } from "@/shared/pagination";

const BASE = "/inspecoes-equipamentos";

export type HeaderOption = { value: string; label: string };

// Opções dos selects: equipamentos (catálogo, tipo `machine`) + planos de
// equipamento. Limitado a PAGE_SIZE_MAX (autocomplete fica para fatia futura).
export async function getEquipmentHeaderOptionsAction(): Promise<
  ActionResult<{ equipment: HeaderOption[]; plans: HeaderOption[] }>
> {
  return officeAction("inspections.equipment.options", async ({ tenantId }) => {
    const [catalogPage, plansPage] = await Promise.all([
      listEpiCatalog(tenantId, { type: "machine", pageSize: PAGE_SIZE_MAX }),
      listInspectionPlans(tenantId, { pageSize: PAGE_SIZE_MAX }),
    ]);
    return {
      equipment: catalogPage.rows.map((e) => ({ value: e.id, label: e.name })),
      plans: plansPage.rows
        .filter((p) => p.type === "equipment")
        .map((p) => ({ value: p.id, label: p.title })),
    };
  });
}

export async function listEquipmentInspectionsAction(
  params: repo.ListEquipmentInspectionsParams = {},
): Promise<ActionResult<Paginated<EquipmentInspectionListItem>>> {
  return officeAction("inspections.equipment.list", ({ tenantId }) =>
    repo.listEquipmentInspections(tenantId, params),
  );
}

export async function getEquipmentInspectionAction(
  id: string,
): Promise<ActionResult<EquipmentInspectionDetail>> {
  return officeAction("inspections.equipment.get", async ({ tenantId }) => {
    const row = await repo.getEquipmentInspection(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createEquipmentInspectionAction(
  input: EquipmentInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.equipment.create",
    async ({ tenantId }) => {
      const result = await repo.createEquipmentInspection(
        tenantId,
        equipmentInspectionHeaderSchema.parse(input),
      );
      if (!result) throw new ReferenceNotFoundError();
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateEquipmentInspectionHeaderAction(
  id: string,
  input: EquipmentInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.equipment.update",
    async ({ tenantId }) => {
      const ok = await repo.updateEquipmentInspectionHeader(
        tenantId,
        id,
        equipmentInspectionHeaderSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function saveEquipmentChecklistAction(
  id: string,
  input: ChecklistInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.equipment.checklist",
    async ({ tenantId }) => {
      const ok = await repo.saveEquipmentChecklist(
        tenantId,
        id,
        checklistSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteEquipmentInspectionAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "inspections.equipment.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteEquipmentInspection(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}
