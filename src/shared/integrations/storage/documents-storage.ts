import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";

/**
 * Storage do GED (fatia 024). Ponto ÚNICO de acesso ao binário no Supabase
 * Storage (bucket privado `documents`). Usa o cliente admin (service key) — toca
 * SÓ o binário; TODA leitura/escrita de dado de negócio no DB continua em
 * `withOrg`/RLS. Isolamento do arquivo vem do path particionado por `org_id`
 * (sempre da sessão) + do registro-espelho RLS em `documents`.
 */
export const DOCUMENTS_BUCKET = "documents";

/** TTL padrão da URL assinada de download (issue #35) — curto de propósito. */
export const SIGNED_DOWNLOAD_URL_TTL_SECONDS = 60;

/** Normaliza o nome preservando a extensão (path opaco, sem acentos/espaços). */
export function slugifyFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1) : "";
  const slug =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "arquivo";
  const extSlug = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return extSlug ? `${slug}.${extSlug}` : slug;
}

export function buildStoragePath(
  orgId: string,
  groupId: string,
  version: number,
  fileName: string,
): string {
  return `${orgId}/documentos/${groupId}/v${version}-${slugifyFileName(fileName)}`;
}

export type StoredObject = { storagePath: string; sizeBytes: number };

/**
 * O path já tem um objeto (upload com `upsert: false`). Acontece quando dois envios
 * disputam a mesma versão com o mesmo nome de arquivo (#56): o path é determinístico
 * (`v{N}-{slug}`), então o segundo upload falha antes de chegar ao INSERT.
 */
export class StorageObjectExistsError extends Error {
  constructor(readonly storagePath: string) {
    super("documents storage object already exists");
    this.name = "StorageObjectExistsError";
  }
}

/**
 * Reconhece o erro de "objeto já existe" do Supabase Storage. O provedor já variou entre
 * `status: 409` e `status: 400` + `statusCode: "409"`, com a mensagem "The resource already
 * exists" — por isso checa os três sinais.
 */
export function isStorageObjectExistsError(error: {
  message?: string;
  status?: number;
  statusCode?: string;
}): boolean {
  return (
    error.status === 409 ||
    error.statusCode === "409" ||
    /already exists|duplicate/i.test(error.message ?? "")
  );
}

/**
 * Grava o binário no path particionado do tenant. `orgId` SEMPRE da sessão. Erro
 * do provedor → lança (o chamador compensa/propaga; nunca vaza detalhe do provedor).
 * Path ocupado → `StorageObjectExistsError`, para o chamador responder com conflito.
 */
export async function putDocumentObject(
  orgId: string,
  groupId: string,
  version: number,
  file: File,
): Promise<StoredObject> {
  const storagePath = buildStoragePath(orgId, groupId, version, file.name);
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) {
    if (isStorageObjectExistsError(error)) {
      throw new StorageObjectExistsError(storagePath);
    }
    throw new Error(`documents storage upload failed: ${error.message}`);
  }
  return { storagePath, sizeBytes: file.size };
}

/** Formato do arquivo gerado por job (extensão do path). */
export type GeneratedDocumentFormat = "docx" | "pdf";

/** Path determinístico do arquivo gerado por job (idempotência da #39 via upsert). */
export function generatedDocumentPath(
  orgId: string,
  documentId: string,
  format: GeneratedDocumentFormat,
): string {
  return `${orgId}/documentos/generated/${documentId}.${format}`;
}

/**
 * Grava (ou sobrescreve) o arquivo gerado por um job em lote (#39) no path
 * determinístico do formato. `upsert:true` torna o reprocessamento idempotente —
 * nunca duplica objeto. `orgId` sempre da linha do job (`job.org_id`).
 */
export async function putGeneratedDocument(
  orgId: string,
  documentId: string,
  file: Buffer,
  options: { format: GeneratedDocumentFormat; contentType: string },
): Promise<StoredObject> {
  const storagePath = generatedDocumentPath(orgId, documentId, options.format);
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: options.contentType, upsert: true });
  if (error) throw new Error(`generated document upload failed: ${error.message}`);
  return { storagePath, sizeBytes: file.byteLength };
}

/** Remove um objeto (compensação de órfão / limpeza pós-exclusão). */
export async function removeDocumentObject(storagePath: string): Promise<void> {
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) throw new Error(`documents storage remove failed: ${error.message}`);
}

export type DownloadedObject =
  | { status: "found"; bytes: Buffer }
  | { status: "missing" }
  | { status: "unavailable" };

export function isStorageObjectMissingError(error: {
  message?: string;
  status?: number;
  statusCode?: string;
}): boolean {
  return (
    error.status === 404 ||
    error.statusCode === "404" ||
    /not[ _]found/i.test(error.message ?? "")
  );
}

export async function downloadDocumentObject(
  storagePath: string,
): Promise<DownloadedObject> {
  const supabase = getRlsBypassingSupabaseClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(storagePath);
  if (error && isStorageObjectMissingError(error)) return { status: "missing" };
  if (error || !data) return { status: "unavailable" };
  return { status: "found", bytes: Buffer.from(await data.arrayBuffer()) };
}

/**
 * Gera URL assinada de curta duração para download (issue #35). O CHAMADOR é
 * responsável por já ter verificado que `storagePath` pertence ao tenant ativo
 * (nunca assina o path cru vindo do cliente) — este wrapper só fala com o
 * Storage. `downloadName`, quando informado, força o `Content-Disposition` do
 * navegador com o nome de exibição do documento em vez do slug opaco do path.
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  options: { ttlSeconds?: number; downloadName?: string } = {},
): Promise<string> {
  const ttlSeconds = options.ttlSeconds ?? SIGNED_DOWNLOAD_URL_TTL_SECONDS;
  const { downloadName } = options;
  const supabase = getRlsBypassingSupabaseClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(
      storagePath,
      ttlSeconds,
      downloadName === undefined ? { download: true } : undefined,
    );
  if (error) throw new Error(`documents storage sign url failed: ${error.message}`);
  return downloadName === undefined
    ? data.signedUrl
    : withDownloadName(data.signedUrl, downloadName);
}

export function withDownloadName(signedUrl: string, downloadName: string): string {
  const separator = signedUrl.includes("?") ? "&" : "?";
  return `${signedUrl}${separator}download=${encodeURIComponent(downloadName)}`;
}

/** Caminho do ASO assinado (NOB-163): tenant da sessão, exame e id do registro; nunca do cliente. */
export function signedAsoPath(orgId: string, examId: string, id: string): string {
  return `${orgId}/aso-assinados/${examId}/${id}.pdf`;
}

/** Grava o PDF assinado do ASO (sem sobrescrever). Erro do provedor → lança, sem detalhe. */
export async function putSignedAsoObject(
  storagePath: string,
  bytes: Uint8Array,
): Promise<void> {
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`signed ASO upload failed: ${error.message}`);
}

/** Caminho do comprovante de entrega do ASO (NOB-165): tenant da sessão, exame e id do registro. */
export function asoDeliveryEvidencePath(
  orgId: string,
  examId: string,
  id: string,
  extension: string,
): string {
  return `${orgId}/aso-entregas/${examId}/${id}.${extension}`;
}

/** Grava o comprovante de entrega (sem sobrescrever). Erro do provedor → lança, sem detalhe. */
export async function putAsoDeliveryEvidence(
  storagePath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (error) throw new Error(`ASO delivery evidence upload failed: ${error.message}`);
}

/** Caminho do PCMSO assinado (NOB-166): tenant da sessão, empresa e id do registro. */
export function signedPcmsoPath(orgId: string, companyId: string, id: string): string {
  return `${orgId}/pcmso-assinados/${companyId}/${id}.pdf`;
}
