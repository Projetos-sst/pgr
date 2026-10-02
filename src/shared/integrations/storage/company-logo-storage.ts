import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";

/**
 * Storage do logo de empresa (issue #4). Mesmo padrão de
 * `documents-storage.ts`: ponto único de acesso ao binário no Supabase
 * Storage, cliente admin (service key), path particionado por `org_id`
 * (sempre da sessão). Bucket **privado** dedicado (`company-logos`), separado
 * do bucket `documents` do GED — não é um documento auditável, é um asset de
 * identidade visual.
 *
 * Nota de infra: o bucket precisa existir no projeto Supabase (criado fora do
 * código, mesmo precedente do bucket `documents`).
 */
export const COMPANY_LOGOS_BUCKET = "company-logos";

/** TTL da URL assinada usada para exibir o preview no formulário. */
export const SIGNED_LOGO_URL_TTL_SECONDS = 3600;

/**
 * Path opaco por tenant + arquivo aleatório — desacoplado do id da empresa de
 * propósito (o upload acontece no formulário de criação, antes da empresa
 * existir). Reenvios não sobrescrevem o path anterior; o objeto antigo fica
 * órfão no bucket (custo desprezível para um ícone, sem job de limpeza nesta
 * correção).
 */
export function buildCompanyLogoPath(
  orgId: string,
  fileId: string,
  extension: string,
): string {
  return `${orgId}/logos/${fileId}.${extension}`;
}

export type StoredLogo = { storagePath: string; sizeBytes: number };

/** Grava o binário no path particionado do tenant. `orgId` SEMPRE da sessão. */
export async function putCompanyLogo(
  orgId: string,
  file: File,
  extension: string,
): Promise<StoredLogo> {
  const storagePath = buildCompanyLogoPath(orgId, crypto.randomUUID(), extension);
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(COMPANY_LOGOS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`company logo upload failed: ${error.message}`);
  return { storagePath, sizeBytes: file.size };
}

/**
 * Gera URL assinada de curta duração para exibir o preview (criação e
 * reabertura do formulário de edição). O CHAMADOR é responsável por já ter
 * verificado que `storagePath` pertence ao tenant ativo.
 */
export async function getSignedCompanyLogoUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_LOGO_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = getRlsBypassingSupabaseClient();
  const { data, error } = await supabase.storage
    .from(COMPANY_LOGOS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error) throw new Error(`company logo sign url failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Baixa o binário do logo (cabeçalho do PGR em DOCX). `null` quando o objeto não existe
 * ou o Storage falha — o documento sai com o logo padrão em vez de quebrar a geração.
 * O CHAMADOR garante que `storagePath` pertence ao tenant ativo (veio de `withOrg`).
 */
export async function downloadCompanyLogo(storagePath: string): Promise<Buffer | null> {
  try {
    const supabase = getRlsBypassingSupabaseClient();
    const { data, error } = await supabase.storage
      .from(COMPANY_LOGOS_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}
