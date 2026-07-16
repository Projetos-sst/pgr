import { z } from "zod";

import { optionalString } from "@/shared/domains/pgr/form-fields";
import type { Vehicle } from "@/shared/db/schema";

export const vehicleTypeSchema = z.enum([
  "car",
  "motorcycle",
  "truck",
  "bus",
  "van",
  "utility",
  "pickup",
  "other",
]);
export type VehicleTypeKey = z.infer<typeof vehicleTypeSchema>;

export const VEHICLE_TYPE_LABELS: Record<VehicleTypeKey, string> = {
  car: "Carro",
  motorcycle: "Moto",
  truck: "Caminhão",
  bus: "Ônibus",
  van: "Van",
  utility: "Utilitário",
  pickup: "Caminhonete",
  other: "Outro",
};

export function vehicleTypeLabel(value: string | null): string {
  if (!value) return "—";
  return VEHICLE_TYPE_LABELS[value as VehicleTypeKey] ?? value;
}

const PLATE_LEGACY = /^[A-Z]{3}[0-9]{4}$/; // AAA0000
const PLATE_MERCOSUL = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/; // AAA0A00

// Placa BR: normaliza (maiúsculas, sem separador) e valida legado OU Mercosul.
export const plateSchema = z
  .string({ error: "Placa é obrigatória" })
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((v) => PLATE_LEGACY.test(v) || PLATE_MERCOSUL.test(v), {
    message: "Placa inválida (use AAA-0000 ou AAA0A00)",
  });

const optionalVehicleType = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  vehicleTypeSchema.optional(),
);

export const vehicleInputSchema = z.object({
  plate: plateSchema,
  brand: optionalString,
  model: optionalString,
  type: optionalVehicleType,
  color: optionalString,
  owner: optionalString,
  initialKm: z.coerce
    .number({ error: "KM inicial inválido" })
    .int()
    .min(0, "KM inicial não pode ser negativo")
    .default(0),
  photoPath: optionalString,
  notes: optionalString,
});
export type VehicleInput = z.input<typeof vehicleInputSchema>;
export type VehicleValues = z.output<typeof vehicleInputSchema>;

export type VehicleListItem = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  typeLabel: string;
  owner: string | null;
  initialKm: number;
};

export function toVehicleListItem(row: Vehicle): VehicleListItem {
  return {
    id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    type: row.type,
    typeLabel: vehicleTypeLabel(row.type),
    owner: row.owner,
    initialKm: row.initialKm,
  };
}
