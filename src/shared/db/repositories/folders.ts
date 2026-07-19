import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import {
  buildBreadcrumb,
  toFolderNode,
  type BreadcrumbItem,
  type CreateFolderValues,
  type FolderNode,
  type RenameFolderValues,
} from "@/shared/domains/documents/folders";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { folders, type Folder } from "../schema/documents";
import { auditedTenantWrite } from "./audited-write";

const MAX_FOLDER_DEPTH = 64;

/** Garante que a pasta (quando informada) pertence ao tenant. Reusado pela 024. */
export async function assertFolderInTenant(
  tx: TenantTransaction,
  orgId: string,
  folderId: string | null,
): Promise<void> {
  if (folderId === null) return;
  const [row] = await tx
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.orgId, orgId), eq(folders.id, folderId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("folder");
}

/** Cadeia raiz→pasta atual (para o breadcrumb). Sobe por `parent_id`. */
async function loadBreadcrumbChain(
  tx: TenantTransaction,
  orgId: string,
  folderId: string | null,
): Promise<FolderNode[]> {
  const chain: FolderNode[] = [];
  let cursor = folderId;
  for (let depth = 0; cursor !== null && depth < MAX_FOLDER_DEPTH; depth += 1) {
    const [row] = await tx
      .select()
      .from(folders)
      .where(and(eq(folders.orgId, orgId), eq(folders.id, cursor)))
      .limit(1);
    if (!row) break;
    chain.unshift(toFolderNode(row));
    cursor = row.parentId;
  }
  return chain;
}

export type FolderTree = { folders: FolderNode[]; breadcrumb: BreadcrumbItem[] };

export async function listFolderTree(
  orgId: string,
  parentId: string | null = null,
): Promise<FolderTree> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.orgId, orgId),
          parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId),
        ),
      )
      .orderBy(asc(folders.name));
    const breadcrumb = buildBreadcrumb(await loadBreadcrumbChain(tx, orgId, parentId));
    return { folders: rows.map(toFolderNode), breadcrumb };
  });
}

export async function createFolder(
  orgId: string,
  values: CreateFolderValues,
): Promise<Folder> {
  return auditedTenantWrite(orgId, "documents.folders.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertFolderInTenant(tx, orgId, values.parentId);
      const [row] = await tx
        .insert(folders)
        .values({ orgId, name: values.name, parentId: values.parentId })
        .returning();
      return row;
    }),
  );
}

export async function renameFolder(
  orgId: string,
  id: string,
  values: RenameFolderValues,
): Promise<Folder | null> {
  return auditedTenantWrite(orgId, "documents.folders.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(folders)
        .set({ name: values.name, updatedAt: new Date() })
        .where(and(eq(folders.orgId, orgId), eq(folders.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}
