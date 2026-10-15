import "server-only";

import { getVehicle } from "@/shared/db/repositories/vehicles";
import { isVehiclePhotoPathForTenant } from "@/shared/domains/inspections/vehicles";
import { validatePhotoFile } from "@/shared/domains/pgr/employee-photo";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { getSignedDownloadUrl } from "@/shared/integrations/storage/documents-storage";
import { putVehiclePhoto } from "@/shared/integrations/storage/vehicle-photo-storage";

const PREVIEW_TTL_SECONDS = 3600;

export async function uploadVehiclePhoto(
  tenantId: string,
  formData: FormData,
): Promise<{ path: string; url: string }> {
  const raw = formData.get("file");
  if (!(raw instanceof File)) throw new ValidationError("Selecione uma imagem.");
  const check = validatePhotoFile(raw);
  if (!check.ok) throw new ValidationError(check.message);
  const path = await putVehiclePhoto(tenantId, raw, check.extension);
  const url = await getSignedDownloadUrl(path, { ttlSeconds: PREVIEW_TTL_SECONDS });
  return { path, url };
}

export async function getVehiclePhotoUrl(
  tenantId: string,
  id: string,
): Promise<{ url: string | null }> {
  const vehicle = await getVehicle(tenantId, id);
  if (!vehicle) throw new NotFoundError();
  if (!vehicle.photoPath) return { url: null };
  // O cliente admin do Storage ignora RLS; só assinamos fotos do tenant ativo.
  if (!isVehiclePhotoPathForTenant(vehicle.photoPath, tenantId)) {
    throw new NotFoundError();
  }
  const url = await getSignedDownloadUrl(vehicle.photoPath, {
    ttlSeconds: PREVIEW_TTL_SECONDS,
  });
  return { url };
}
