"use server";

import { revalidatePath } from "next/cache";

import { listCompanyOptions } from "@/shared/db/repositories/companies";
import * as repo from "@/shared/db/repositories/safety-inspections";
import {
  inspectionCategoryLabel,
  occurrencesSchema,
  safetyInspectionHeaderSchema,
  type OccurrencesInput,
  type SafetyInspectionDetail,
  type SafetyInspectionHeaderInput,
  type SafetyInspectionListItem,
} from "@/shared/domains/inspections/safety-inspections";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  createSignatureRequest,
  type CreateSignatureRequestResult,
} from "@/shared/server/actions/signatures";

const BASE = "/safety-inspections";

export type CompanyOption = { value: string; label: string };

// Opções de empresa (opcional) para o cabeçalho da inspeção de segurança.
export async function listSafetyCompanyOptionsAction(): Promise<
  ActionResult<CompanyOption[]>
> {
  return officeAction("inspections.safety.company_options", async ({ tenantId }) => {
    const options = await listCompanyOptions(tenantId);
    return options.map((c) => ({ value: c.id, label: c.razaoSocial }));
  });
}

export async function listSafetyInspectionsAction(
  params: repo.ListSafetyInspectionsParams = {},
): Promise<ActionResult<Paginated<SafetyInspectionListItem>>> {
  return officeAction("inspections.safety.list", ({ tenantId }) =>
    repo.listSafetyInspections(tenantId, params),
  );
}

export async function getSafetyInspectionAction(
  id: string,
): Promise<ActionResult<SafetyInspectionDetail>> {
  return officeAction("inspections.safety.get", async ({ tenantId }) => {
    const row = await repo.getSafetyInspection(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createSafetyInspectionAction(
  input: SafetyInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.safety.create",
    async ({ tenantId }) => {
      const result = await repo.createSafetyInspection(
        tenantId,
        safetyInspectionHeaderSchema.parse(input),
      );
      if (!result) throw new ReferenceNotFoundError();
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateSafetyInspectionHeaderAction(
  id: string,
  input: SafetyInspectionHeaderInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.safety.update",
    async ({ tenantId }) => {
      const ok = await repo.updateSafetyInspectionHeader(
        tenantId,
        id,
        safetyInspectionHeaderSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function saveOccurrencesAction(
  id: string,
  input: OccurrencesInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.safety.occurrences",
    async ({ tenantId }) => {
      const ok = await repo.saveOccurrences(tenantId, id, occurrencesSchema.parse(input));
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteSafetyInspectionAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "inspections.safety.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteSafetyInspection(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}

/**
 * Solicita assinatura digital da inspeção reusando a infra de assinaturas
 * (target_type `inspection`). Monta o payload não-editável a partir do estado
 * atual da inspeção. Requer que a inspeção exista no tenant (senão NOT_FOUND).
 */
export async function requestInspectionSignatureAction(
  id: string,
): Promise<ActionResult<CreateSignatureRequestResult>> {
  const loaded = await getSafetyInspectionAction(id);
  if (!loaded.ok) return loaded;
  const { inspection, company, occurrences } = loaded.data;

  return createSignatureRequest({
    targetType: "inspection",
    targetId: id,
    payload: {
      title: `Inspeção de segurança — ${company?.razaoSocial ?? inspection.area ?? "geral"}`,
      category: inspectionCategoryLabel(inspection.category),
      area: inspection.area ?? undefined,
      responsible: inspection.responsible ?? undefined,
      inspectedAt: inspection.inspectedAt,
      occurrenceCount: occurrences.length,
    },
  });
}
