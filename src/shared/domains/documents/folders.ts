import { z } from "zod";

import type { Folder } from "@/shared/db/schema/documents";
import { requiredString } from "@/shared/domains/pgr/form-fields";

export type { Folder };

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** `parent_id`: `null` = raiz; string vazia/ausente → `null`. */
const nullableParentId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : (value ?? null)),
  z.string().regex(UUID_FORMAT, "Pasta-pai inválida").nullable(),
);

export const createFolderSchema = z.object({
  name: requiredString("Nome da pasta é obrigatório").max(255, "Nome muito longo"),
  parentId: nullableParentId.optional().default(null),
});
export type CreateFolderInput = z.input<typeof createFolderSchema>;
export type CreateFolderValues = z.output<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  name: requiredString("Nome da pasta é obrigatório").max(255, "Nome muito longo"),
});
export type RenameFolderValues = z.output<typeof renameFolderSchema>;

/** Nó de árvore (pasta filha direta da pasta atual). */
export type FolderNode = { id: string; name: string; parentId: string | null };

/** Item da trilha de navegação; a raiz é o item "Início" (`id: null`). */
export type BreadcrumbItem = { id: string | null; name: string };

export const ROOT_BREADCRUMB: BreadcrumbItem = { id: null, name: "Início" };

/**
 * Monta o breadcrumb a partir da cadeia raiz→pasta atual (exclusive da raiz
 * lógica). `chain[0]` é a pasta mais próxima da raiz; o último é a pasta atual.
 * Sempre prefixa com "Início".
 */
export function buildBreadcrumb(chain: readonly FolderNode[]): BreadcrumbItem[] {
  return [ROOT_BREADCRUMB, ...chain.map((f) => ({ id: f.id, name: f.name }))];
}

export function toFolderNode(row: Folder): FolderNode {
  return { id: row.id, name: row.name, parentId: row.parentId };
}
