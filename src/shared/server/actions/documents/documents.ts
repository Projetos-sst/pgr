"use server";

import { revalidatePath } from "next/cache";

import {
  documentMetadataSchema,
  updateDocumentSchema,
  moveDocumentSchema,
  type DocumentDetail,
  type UpdateDocumentInput,
  type MoveDocumentInput,
} from "@/shared/domains/documents/documents";
import type { BreadcrumbItem, FolderNode } from "@/shared/domains/documents/folders";
import { validateFile } from "@/shared/domains/documents/files";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/documents";
import { listDocumentVersions } from "@/shared/db/repositories/document-versions";
import type { DocumentVersionItem } from "@/shared/domains/documents/versions";
import { listFolderTree } from "@/shared/db/repositories/folders";
import type { DocumentKpis } from "@/shared/domains/documents/kpis";
import type { DocumentListItem } from "@/shared/domains/documents/documents";

const BASE_PATH = "/documents";

export type DocumentsView = Paginated<DocumentListItem> & {
  kpis: DocumentKpis;
  folders: FolderNode[];
  breadcrumb: BreadcrumbItem[];
};

export async function listDocumentsAction(
  params: repo.ListDocumentsParams = {},
): Promise<ActionResult<DocumentsView>> {
  return officeAction("documents.documents.list", async ({ tenantId }) => {
    const folderId = params.folderId ?? null;
    const [list, tree] = await Promise.all([
      repo.listDocuments(tenantId, params),
      listFolderTree(tenantId, folderId),
    ]);
    return {
      rows: list.rows,
      total: list.total,
      kpis: list.kpis,
      folders: tree.folders,
      breadcrumb: tree.breadcrumb,
    };
  });
}

export async function getDocumentAction(
  id: string,
): Promise<ActionResult<DocumentDetail>> {
  return officeAction("documents.documents.get", async ({ tenantId }) => {
    const doc = await repo.getDocumentById(tenantId, id);
    if (!doc) throw new NotFoundError();
    return doc;
  });
}

/**
 * Histórico de versões do documento lógico (#56): mais nova primeiro, exatamente uma vigente.
 * Qualquer versão do grupo serve de ponto de entrada. Outro escritório → NOT_FOUND.
 */
export async function listDocumentVersionsAction(
  id: string,
): Promise<ActionResult<DocumentVersionItem[]>> {
  return officeAction("documents.documents.versions", async ({ tenantId }) => {
    const versions = await listDocumentVersions(tenantId, id);
    if (!versions) throw new NotFoundError();
    return versions;
  });
}

export async function createDocumentAction(
  formData: FormData,
): Promise<ActionResult<DocumentDetail>> {
  return officeAction(
    "documents.documents.create",
    async ({ tenantId }) => {
      const raw = formData.get("file");
      const file = raw instanceof File ? raw : null;
      const check = validateFile(file);
      if (!check.ok) throw new ValidationError(check.message);

      const metadata = documentMetadataSchema.parse({
        name: formData.get("name"),
        docType: formData.get("docType"),
        validUntil: formData.get("validUntil") ?? "",
        folderId: formData.get("folderId") ?? "",
        relatedEntityType: formData.get("relatedEntityType") ?? undefined,
        relatedEntityId: formData.get("relatedEntityId") ?? "",
      });

      const created = await repo.createDocument(tenantId, { metadata, file: file! });
      revalidatePath(BASE_PATH);
      return created;
    },
    { audit: true },
  );
}

export async function updateDocumentAction(
  id: string,
  input: UpdateDocumentInput,
): Promise<ActionResult<DocumentDetail>> {
  return officeAction(
    "documents.documents.update",
    async ({ tenantId }) => {
      const patch = updateDocumentSchema.parse(input);
      const updated = await repo.updateDocument(tenantId, id, patch);
      if (!updated) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return updated;
    },
    { audit: true },
  );
}

export async function addDocumentVersionAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<DocumentDetail>> {
  return officeAction(
    "documents.documents.add_version",
    async ({ tenantId }) => {
      const raw = formData.get("file");
      const file = raw instanceof File ? raw : null;
      const check = validateFile(file);
      if (!check.ok) throw new ValidationError(check.message);

      const created = await repo.addDocumentVersion(tenantId, id, file!);
      if (!created) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return created;
    },
    { audit: true },
  );
}

export async function moveDocumentAction(
  id: string,
  input: MoveDocumentInput,
): Promise<ActionResult<DocumentDetail>> {
  return officeAction(
    "documents.documents.move",
    async ({ tenantId }) => {
      const { folderId } = moveDocumentSchema.parse(input);
      const moved = await repo.moveDocument(tenantId, id, folderId);
      if (!moved) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return moved;
    },
    { audit: true },
  );
}

export async function deleteDocumentAction(
  id: string,
): Promise<ActionResult<repo.DeleteDocumentResult>> {
  return officeAction(
    "documents.documents.delete",
    async ({ tenantId }) => {
      const result = await repo.deleteDocument(tenantId, id);
      if (!result) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return result;
    },
    { audit: true },
  );
}
