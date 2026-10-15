import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import { DOCUMENTS_BUCKET } from "./documents-storage";

// Reusa o bucket privado já provisionado, como as fotos do catálogo de EPI.
export async function putVehiclePhoto(
  tenantId: string,
  file: File,
  extension: string,
): Promise<string> {
  const path = `${tenantId}/vehicles/${crypto.randomUUID()}/foto.${extension}`;
  const { error } = await getRlsBypassingSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`vehicle photo upload failed: ${error.message}`);
  return path;
}
