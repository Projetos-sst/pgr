import { z } from "zod";

import type { Document } from "@/shared/db/schema/documents";
import { requiredString, optionalIsoDate } from "@/shared/domains/pgr/form-fields";

import {
  classifyDocumentValidity,
  documentRelatedEntityTypeSchema,
  type DocumentValidityStatus,
} from "./validity";

export type { Document };

/** Janela de "a vencer" do GED (dias), fixa em 30 (spec FR-002). */
export const DOCUMENT_DUE_WINDOW_DAYS = 30;

/** Conjunto fechado de status de validade filtráveis na listagem. */
export const documentValidityFilterSchema = z.enum([
  "ok",
  "due_soon",
  "expired",
  "no_expiry",
]);
export type DocumentValidityFilter = z.infer<typeof documentValidityFilterSchema>;

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** `folder_id`/pasta destino: `null` = raiz; string vazia/ausente → `null`. */
const nullableFolderId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : (value ?? null)),
  z.string().regex(UUID_FORMAT, "Pasta inválida").nullable(),
);

const nullableEntityId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : (value ?? null)),
  z.string().regex(UUID_FORMAT, "Vínculo inválido").nullable(),
);

/**
 * Metadados de documento (criação e base da edição). O vínculo polimórfico é
 * completo-ou-vazio (espelha o CHECK `documents_related_entity_check` da 023).
 */
export const documentMetadataSchema = z
  .object({
    name: requiredString("Nome é obrigatório").max(255, "Nome muito longo"),
    docType: requiredString("Tipo é obrigatório").max(120, "Tipo muito longo"),
    validUntil: optionalIsoDate,
    folderId: nullableFolderId.optional().default(null),
    relatedEntityType: documentRelatedEntityTypeSchema.nullish(),
    relatedEntityId: nullableEntityId.optional().default(null),
  })
  .refine((data) => (data.relatedEntityType == null) === (data.relatedEntityId == null), {
    error: "Vínculo deve ter tipo e identificador juntos, ou nenhum dos dois.",
    path: ["relatedEntityId"],
  });

export type DocumentMetadataInput = z.input<typeof documentMetadataSchema>;
export type DocumentMetadataValues = z.output<typeof documentMetadataSchema>;

/** Atualização parcial de metadados (não troca arquivo — isso é nova versão). */
export const updateDocumentSchema = z
  .object({
    name: requiredString("Nome é obrigatório").max(255).optional(),
    docType: requiredString("Tipo é obrigatório").max(120).optional(),
    validUntil: optionalIsoDate,
    relatedEntityType: documentRelatedEntityTypeSchema.nullish(),
    relatedEntityId: nullableEntityId.optional(),
  })
  .refine(
    (data) =>
      data.relatedEntityType === undefined && data.relatedEntityId === undefined
        ? true
        : (data.relatedEntityType == null) === (data.relatedEntityId == null),
    {
      error: "Vínculo deve ter tipo e identificador juntos, ou nenhum dos dois.",
      path: ["relatedEntityId"],
    },
  );
export type UpdateDocumentInput = z.input<typeof updateDocumentSchema>;
export type UpdateDocumentValues = z.output<typeof updateDocumentSchema>;

/** Mover documento entre pastas (`null` = raiz). */
export const moveDocumentSchema = z.object({ folderId: nullableFolderId });
export type MoveDocumentInput = z.input<typeof moveDocumentSchema>;
export type MoveDocumentValues = z.output<typeof moveDocumentSchema>;

/** DTO de listagem: 1 linha por documento lógico (versão corrente). */
export type DocumentListItem = {
  id: string;
  documentGroupId: string;
  name: string;
  docType: string;
  version: number;
  sizeBytes: number;
  folderId: string | null;
  createdAt: string;
  validUntil: string | null;
  validityStatus: DocumentValidityStatus;
};

/** DTO de detalhe (inclui `storagePath` e vínculo). */
export type DocumentDetail = DocumentListItem & {
  storagePath: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  updatedAt: string;
};

type DocumentRow = Pick<
  Document,
  | "id"
  | "documentGroupId"
  | "name"
  | "docType"
  | "version"
  | "sizeBytes"
  | "folderId"
  | "validUntil"
> & { createdAt: Date | string };

export function toDocumentListItem(row: DocumentRow, today: string): DocumentListItem {
  return {
    id: row.id,
    documentGroupId: row.documentGroupId,
    name: row.name,
    docType: row.docType,
    version: row.version,
    sizeBytes: row.sizeBytes,
    folderId: row.folderId,
    createdAt:
      typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    validUntil: row.validUntil,
    validityStatus: classifyDocumentValidity(row.validUntil, {
      today,
      dueWindowDays: DOCUMENT_DUE_WINDOW_DAYS,
    }),
  };
}

export function toDocumentDetail(row: Document, today: string): DocumentDetail {
  return {
    ...toDocumentListItem(row, today),
    storagePath: row.storagePath,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : (row.updatedAt as Date).toISOString(),
  };
}

/**
 * Nome de exibição do download (issue #35): `name` do documento com a extensão
 * REAL do arquivo gravado (preservada no path pelo upload), não a que o usuário
 * eventualmente digitou em `name`. Pura — reusada pela Server Action e pelo
 * REST mirror de download, ambos assinando a mesma URL.
 */
export function downloadFileName(name: string, storagePath: string): string {
  const storedFileName = storagePath.split("/").pop() ?? "";
  const dot = storedFileName.lastIndexOf(".");
  const extension = dot > 0 ? storedFileName.slice(dot) : "";
  return extension && !name.toLowerCase().endsWith(extension.toLowerCase())
    ? `${name}${extension}`
    : name;
}
