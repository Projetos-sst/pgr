"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  epiCatalogInputSchema,
  type EpiCatalogInput,
  type EpiCatalogListItem,
} from "@/shared/domains/pgr/epi-catalog";
import { validateEpiCatalogPhotoFile } from "@/shared/domains/pgr/epi-catalog-photo";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-catalog";
import * as auditRepo from "@/shared/db/repositories/epi-catalog-audit";
import type { EpiCatalog } from "@/shared/db/schema/epis";
import { putEpiCatalogPhoto } from "@/shared/integrations/storage/epi-catalog-photo-storage";
import { getSignedDownloadUrl } from "@/shared/integrations/storage/documents-storage";

const BASE_PATH = "/epi-catalog";
/** TTL curto o bastante para o preview no formulário sem ficar reassinando a cada render. */
const PHOTO_PREVIEW_URL_TTL_SECONDS = 300;

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
    async ({ tenantId, userId }) => {
      const data = epiCatalogInputSchema.parse(input);
      // `createdBy` (issue #27) vem SEMPRE da sessão — nunca de `input`, que nem
      // tem esse campo no schema (ver domains/pgr/epi-catalog.ts).
      const row = await repo.createEpiCatalog(tenantId, data, { createdBy: userId });
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
    async ({ tenantId, userId }) => {
      const data = epiCatalogInputSchema.parse(input);
      // `createdBy` é imutável — só o `changedBy` do log de auditoria muda a cada
      // update (quem cadastrou o item nunca muda depois de criado).
      const row = await repo.updateEpiCatalog(tenantId, id, data, { changedBy: userId });
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

/**
 * Sobe a foto do item do catálogo para o Storage (issue #30) e devolve o path
 * a persistir em `photoPath` + uma URL assinada para o preview imediato no
 * formulário. Não grava em `epi_catalog` — quem persiste o path é
 * create/updateEpiCatalogAction, chamado em seguida pelo formulário. `photoId`
 * é gerado aqui (nunca aceito do cliente), mesmo precedente de
 * `uploadEmployeePhotoAction` (#16).
 */
export async function uploadEpiCatalogPhotoAction(
  formData: FormData,
): Promise<ActionResult<{ path: string; url: string }>> {
  return officeAction(
    "pgr.epi_catalog.upload_photo",
    async ({ tenantId }) => {
      const raw = formData.get("file");
      const file = raw instanceof File ? raw : null;
      const check = validateEpiCatalogPhotoFile(file);
      if (!check.ok) throw new ValidationError(check.message);

      const photoId = crypto.randomUUID();
      const { storagePath } = await putEpiCatalogPhoto(
        tenantId,
        photoId,
        file!,
        check.extension,
      );
      const url = await getSignedDownloadUrl(storagePath, {
        ttlSeconds: PHOTO_PREVIEW_URL_TTL_SECONDS,
      });
      return { path: storagePath, url };
    },
    { audit: true },
  );
}

/**
 * URL assinada de curta duração para exibir a foto já salva de um item
 * (edição). `photoPath` nunca vem do cliente — sempre lido do registro já
 * escopado pelo tenant da sessão (mesmo padrão de `downloadDocumentAction`).
 */
export async function getEpiCatalogPhotoUrlAction(
  id: string,
): Promise<ActionResult<{ url: string | null }>> {
  return officeAction("pgr.epi_catalog.photo_url", async ({ tenantId }) => {
    const row = await repo.getEpiCatalogById(tenantId, id);
    if (!row) throw new NotFoundError();
    if (!row.photoPath) return { url: null };
    const url = await getSignedDownloadUrl(row.photoPath, {
      ttlSeconds: PHOTO_PREVIEW_URL_TTL_SECONDS,
    });
    return { url };
  });
}

/** Histórico de alterações do item (issue #25), mais recente primeiro. */
export async function listEpiCatalogAuditAction(
  id: string,
): Promise<ActionResult<auditRepo.EpiCatalogAuditLog[]>> {
  return officeAction("pgr.epi_catalog.audit_list", ({ tenantId }) =>
    auditRepo.listEpiCatalogAudit(tenantId, id),
  );
}
