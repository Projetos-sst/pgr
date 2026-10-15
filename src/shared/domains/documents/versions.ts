import type { Document } from "@/shared/db/schema/documents";
import {
  toDocumentListItem,
  type DocumentListItem,
} from "@/shared/domains/documents/documents";

/**
 * Histórico de versões de um documento lógico (#56).
 *
 * Qual versão é a vigente **não** é decidido aqui: o repositório
 * (`db/repositories/document-versions.ts`) é o único lugar com essa regra — hoje "maior
 * versão do grupo"; quando existir aprovação (#54), "maior versão aprovada". Este módulo só
 * recebe o número da vigente e monta o DTO.
 */

/** Item do histórico: mesma forma da listagem + se é a versão vigente. */
export type DocumentVersionItem = DocumentListItem & { isCurrent: boolean };

type VersionRow = Pick<
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

/**
 * Ordena da versão mais nova para a mais antiga e marca a vigente. Função pura: `today`
 * vem do chamador (fuso `America/Sao_Paulo`) para a validade derivada ser determinística.
 */
export function toDocumentVersionHistory(
  rows: VersionRow[],
  currentVersion: number,
  today: string,
): DocumentVersionItem[] {
  return [...rows]
    .sort((a, b) => b.version - a.version)
    .map((row) => ({
      ...toDocumentListItem(row, today),
      isCurrent: row.version === currentVersion,
    }));
}
