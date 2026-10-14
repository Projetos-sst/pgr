import "server-only";

import { Readable } from "node:stream";

import { docs as googleDocs, type docs_v1 } from "@googleapis/docs";
import { auth as googleAuth, drive as googleDrive } from "@googleapis/drive";

import { findLeftoverMarkers } from "@/shared/integrations/docx/template-engine";

import type { GoogleDocsConfig } from "./config";
import { withGoogleRetry, type GoogleRetryOptions } from "./retry";

/**
 * Cliente Google Drive + Docs por Service Account — as peças do fluxo de documentos do
 * Salesbud (`GoogleService` + `GoogleDocsService`), enxutas para o PGR:
 *
 * - `uploadDocxAsGoogleDoc` / `exportFile` / `deleteFile`: converte o DOCX já preenchido
 *   (docxtemplater) em PDF pelo motor do Google Docs — o provedor `google` do PGR;
 * - `copyFile` + `replaceAllText` + `readDocumentText`: o preenchimento "à Salesbud",
 *   direto num Google Doc modelo (só marcadores planos, sem repetir linhas de tabela).
 *
 * Toda chamada passa pelo `withGoogleRetry` (429/503/408 com backoff).
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXPORT_MIME = { pdf: "application/pdf", docx: DOCX_MIME } as const;

export type GoogleExportFormat = keyof typeof EXPORT_MIME;

export function createGoogleDocsClient(
  config: GoogleDocsConfig,
  retry: GoogleRetryOptions = {},
) {
  const auth = new googleAuth.GoogleAuth({
    credentials: config.credentials,
    scopes: SCOPES,
    clientOptions: config.subject ? { subject: config.subject } : undefined,
  });
  const drive = googleDrive({ version: "v3", auth });
  const docs = googleDocs({ version: "v1", auth });
  const parents = config.folderId ? [config.folderId] : undefined;
  const call = <T>(operation: () => Promise<T>) => withGoogleRetry(operation, retry);

  return {
    /** Sobe o DOCX convertendo para Google Doc (o Drive faz a importação). Retorna o id. */
    async uploadDocxAsGoogleDoc(docx: Buffer, name: string): Promise<string> {
      const response = await call(() =>
        drive.files.create({
          requestBody: { name, mimeType: GOOGLE_DOC_MIME, parents },
          media: { mimeType: DOCX_MIME, body: Readable.from(docx) },
          fields: "id",
          supportsAllDrives: true,
        }),
      );
      if (!response.data.id) throw new Error("Drive não devolveu o id do arquivo");
      return response.data.id;
    },

    /** Copia um Google Doc modelo (o `cloneTemplate` do Salesbud). Retorna o id da cópia. */
    async copyFile(fileId: string, name: string): Promise<string> {
      const response = await call(() =>
        drive.files.copy({
          fileId,
          requestBody: { name, mimeType: GOOGLE_DOC_MIME, parents },
          fields: "id",
          supportsAllDrives: true,
        }),
      );
      if (!response.data.id) throw new Error("Drive não devolveu o id da cópia");
      return response.data.id;
    },

    /**
     * `replaceAllText` em lote (o `batchReplaceText` do Salesbud): uma request por
     * marcador, `matchCase`. Retorna quantas ocorrências foram trocadas.
     */
    async replaceAllText(
      documentId: string,
      replacements: Record<string, string>,
    ): Promise<number> {
      const requests: docs_v1.Schema$Request[] = Object.entries(replacements).map(
        ([marker, value]) => ({
          replaceAllText: {
            containsText: { text: marker, matchCase: true },
            replaceText: value,
          },
        }),
      );
      if (requests.length === 0) return 0;
      const response = await call(() =>
        docs.documents.batchUpdate({ documentId, requestBody: { requests } }),
      );
      return (response.data.replies ?? []).reduce(
        (sum, reply) => sum + (reply.replaceAllText?.occurrencesChanged ?? 0),
        0,
      );
    },

    /** Texto do documento (corpo + tabelas), para conferir marcadores que sobraram. */
    async readDocumentText(documentId: string): Promise<string> {
      const response = await call(() => docs.documents.get({ documentId }));
      return structuralText(response.data.body?.content ?? []);
    },

    async exportFile(fileId: string, format: GoogleExportFormat): Promise<Buffer> {
      const response = await call(() =>
        drive.files.export(
          { fileId, mimeType: EXPORT_MIME[format] },
          { responseType: "arraybuffer" },
        ),
      );
      return Buffer.from(response.data as ArrayBuffer);
    },

    async deleteFile(fileId: string): Promise<void> {
      await call(() => drive.files.delete({ fileId, supportsAllDrives: true }));
    },
  };
}

export type GoogleDocsClient = ReturnType<typeof createGoogleDocsClient>;

function structuralText(content: docs_v1.Schema$StructuralElement[]): string {
  return content
    .map((element) => {
      if (element.paragraph) {
        return (element.paragraph.elements ?? [])
          .map((part) => part.textRun?.content ?? "")
          .join("");
      }
      if (element.table) {
        return (element.table.tableRows ?? [])
          .flatMap((row) => row.tableCells ?? [])
          .map((cell) => structuralText(cell.content ?? []))
          .join("\n");
      }
      return "";
    })
    .join("");
}

/** Remove o arquivo temporário sem mascarar o erro principal (best effort). */
async function cleanup(client: GoogleDocsClient, fileId: string) {
  try {
    await client.deleteFile(fileId);
  } catch {
    // Arquivo órfão na pasta da Service Account — não derruba a geração.
  }
}

/**
 * DOCX pronto → PDF (ou DOCX normalizado) pelo Google Docs: sobe convertendo, exporta e
 * apaga o temporário. É o provedor `google` do PGR (`PGR_DOCX_PDF_PROVIDER=google`).
 */
export async function convertDocxWithGoogle(
  client: GoogleDocsClient,
  docx: Buffer,
  name: string,
  format: GoogleExportFormat = "pdf",
): Promise<Buffer> {
  const fileId = await client.uploadDocxAsGoogleDoc(docx, name);
  try {
    return await client.exportFile(fileId, format);
  } finally {
    await cleanup(client, fileId);
  }
}

export type FillGoogleDocResult = {
  buffer: Buffer;
  /** Marcadores `{{...}}` que ficaram no documento (o "remainingMarkers" do Salesbud). */
  leftoverMarkers: string[];
  occurrencesChanged: number;
};

/**
 * Fluxo Salesbud completo sobre um Google Doc modelo: copia → `replaceAllText` com os
 * marcadores planos (`{"{{company.razaoSocial}}": "..."}`) → confere o que sobrou →
 * exporta → apaga a cópia. Serve para modelos simples mantidos direto no Drive; o PGR,
 * que repete linhas de tabela, usa o docxtemplater + `convertDocxWithGoogle`.
 */
export async function fillGoogleDocTemplate(
  client: GoogleDocsClient,
  input: {
    templateId: string;
    name: string;
    replacements: Record<string, string>;
    format?: GoogleExportFormat;
  },
): Promise<FillGoogleDocResult> {
  const documentId = await client.copyFile(input.templateId, input.name);
  try {
    const occurrencesChanged = await client.replaceAllText(
      documentId,
      input.replacements,
    );
    const leftoverMarkers = findLeftoverMarkers(
      await client.readDocumentText(documentId),
    );
    const buffer = await client.exportFile(documentId, input.format ?? "pdf");
    return { buffer, leftoverMarkers, occurrencesChanged };
  } finally {
    await cleanup(client, documentId);
  }
}

/**
 * Achata um objeto em marcadores planos para o `replaceAllText`:
 * `{company: {razaoSocial: "X"}}` → `{"{{company.razaoSocial}}": "X"}`. Listas e
 * valores não-texto ficam de fora (não há como repeti-los com `replaceAllText`).
 */
export function flattenToMarkers(
  data: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const markers: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || typeof value === "number") {
      markers[`{{${path}}}`] = String(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(markers, flattenToMarkers(value as Record<string, unknown>, path));
    }
  }
  return markers;
}
