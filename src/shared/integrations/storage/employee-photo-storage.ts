import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";

/**
 * Storage da foto de funcionário (issue #16). Mesmo padrão de
 * `company-logo-storage.ts` (issue #4, logo de empresa): ponto único de
 * acesso ao binário no Supabase Storage, cliente admin (service key), path
 * particionado por `org_id` (sempre da sessão). Bucket **privado** dedicado
 * (`employee-photos`), separado do bucket `documents` do GED — não é um
 * documento auditável, é um asset de identificação visual.
 *
 * Nota de infra: o bucket precisa existir no projeto Supabase (criado fora do
 * código, mesmo precedente do bucket `documents` / `company-logos`).
 */
export const EMPLOYEE_PHOTOS_BUCKET = "employee-photos";

/** TTL da URL assinada usada para exibir o preview no formulário. */
export const SIGNED_PHOTO_URL_TTL_SECONDS = 3600;

/**
 * Path opaco por tenant + arquivo aleatório — desacoplado do id do
 * funcionário de propósito (o upload acontece no formulário de criação,
 * antes do funcionário existir). Reenvios não sobrescrevem o path anterior;
 * o objeto antigo fica órfão no bucket (custo desprezível para uma foto, sem
 * job de limpeza nesta correção — mesma decisão da issue #4).
 */
export function buildEmployeePhotoPath(
  orgId: string,
  fileId: string,
  extension: string,
): string {
  return `${orgId}/fotos/${fileId}.${extension}`;
}

export type StoredPhoto = { storagePath: string; sizeBytes: number };

/** Grava o binário no path particionado do tenant. `orgId` SEMPRE da sessão. */
export async function putEmployeePhoto(
  orgId: string,
  file: File,
  extension: string,
): Promise<StoredPhoto> {
  const storagePath = buildEmployeePhotoPath(orgId, crypto.randomUUID(), extension);
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(EMPLOYEE_PHOTOS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`employee photo upload failed: ${error.message}`);
  return { storagePath, sizeBytes: file.size };
}

/**
 * Gera URL assinada de curta duração para exibir o preview (criação e
 * reabertura do formulário de edição). O CHAMADOR é responsável por já ter
 * verificado que `storagePath` pertence ao tenant ativo.
 */
export async function getSignedEmployeePhotoUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_PHOTO_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = getRlsBypassingSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EMPLOYEE_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error) throw new Error(`employee photo sign url failed: ${error.message}`);
  return data.signedUrl;
}
