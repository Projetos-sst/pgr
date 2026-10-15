import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import { DOCUMENTS_BUCKET } from "./documents-storage";

/**
 * Foto de item do catálogo de EPI (issue #30). Reusa o bucket privado
 * `documents` (já provisionado) em vez de provisionar um bucket novo só para
 * este campo — mesmo precedente de `employee-photo-storage.ts` (#16): path
 * particionado por org_id, convenção `<bucket>/<org_id>/<modulo>/...`.
 *
 * Path fixo por `photoId` + extensão (sem o nome original do arquivo):
 * reenviar a foto do mesmo item sobrescreve o mesmo objeto (`upsert: true`),
 * sem acumular versões — a foto não tem histórico, ao contrário de
 * `documents`.
 */
export function buildEpiCatalogPhotoPath(
  orgId: string,
  photoId: string,
  extension: string,
): string {
  return `${orgId}/epi-catalog/${photoId}/foto.${extension}`;
}

export type StoredEpiCatalogPhoto = { storagePath: string };

/**
 * Grava o binário no path particionado do tenant. `orgId` SEMPRE da sessão.
 * `photoId` é gerado no servidor (nunca aceito do cliente) — mesmo precedente
 * de `documentGroupId` em `repositories/documents.ts`.
 */
export async function putEpiCatalogPhoto(
  orgId: string,
  photoId: string,
  file: File,
  extension: string,
): Promise<StoredEpiCatalogPhoto> {
  const storagePath = buildEpiCatalogPhotoPath(orgId, photoId, extension);
  const supabase = getRlsBypassingSupabaseClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`epi catalog photo upload failed: ${error.message}`);
  return { storagePath };
}
