"use server";

import { revalidatePath } from "next/cache";

import {
  createFolderSchema,
  renameFolderSchema,
  toFolderNode,
  type CreateFolderInput,
  type FolderNode,
} from "@/shared/domains/documents/folders";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import * as repo from "@/shared/db/repositories/folders";

const BASE_PATH = "/documents";

export async function listFolderTreeAction(
  parentId: string | null = null,
): Promise<ActionResult<repo.FolderTree>> {
  return officeAction("documents.folders.tree", ({ tenantId }) =>
    repo.listFolderTree(tenantId, parentId),
  );
}

export async function createFolderAction(
  input: CreateFolderInput,
): Promise<ActionResult<FolderNode>> {
  return officeAction(
    "documents.folders.create",
    async ({ tenantId }) => {
      const values = createFolderSchema.parse(input);
      const folder = await repo.createFolder(tenantId, values);
      revalidatePath(BASE_PATH);
      return toFolderNode(folder);
    },
    { audit: true },
  );
}

export async function renameFolderAction(
  id: string,
  name: string,
): Promise<ActionResult<FolderNode>> {
  return officeAction(
    "documents.folders.rename",
    async ({ tenantId }) => {
      const values = renameFolderSchema.parse({ name });
      const folder = await repo.renameFolder(tenantId, id, values);
      if (!folder) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return toFolderNode(folder);
    },
    { audit: true },
  );
}
