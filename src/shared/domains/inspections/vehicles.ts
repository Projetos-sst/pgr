import { z } from "zod";

import { optionalString, optionalUuid } from "@/shared/domains/pgr/form-fields";
import {
  classifyDocumentValidity,
  type DocumentValidityStatus,
} from "@/shared/domains/documents/validity";

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

// ── Frequência de inspeção ──────────────────────────────────────────────────────

export const inspectionFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
]);
export type InspectionFrequency = z.infer<typeof inspectionFrequencySchema>;

export const INSPECTION_FREQUENCY_LABELS: Record<InspectionFrequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

/** Intervalo (dias) de cada frequência — base para derivar o vencimento da inspeção. */
export const INSPECTION_FREQUENCY_DAYS: Record<InspectionFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semiannual: 182,
  annual: 365,
};

export function inspectionFrequencyLabel(value: string | null): string {
  if (!value) return "—";
  return INSPECTION_FREQUENCY_LABELS[value as InspectionFrequency] ?? value;
}

// ── Status de inspeção do veículo (derivado — nunca persistido) ─────────────────
// Regular / A vencer / Vencida (mockup) a partir da última inspeção + frequência.

export type VehicleInspectionStatus = "none" | "regular" | "due_soon" | "expired";

export const VEHICLE_INSPECTION_STATUS_LABELS: Record<VehicleInspectionStatus, string> = {
  none: "Sem inspeção",
  regular: "Regular",
  due_soon: "A vencer",
  expired: "Vencida",
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Deriva o status de inspeção do veículo (fuso via `today`, AAAA-MM-DD):
 * sem inspeção → `none`; com inspeção e sem frequência → `regular` (sem vencimento
 * a cobrar); com frequência → vence em `última + intervalo`, classificado por
 * `classifyDocumentValidity` (ok→regular, due_soon→A vencer, expired→Vencida).
 */
export function classifyVehicleInspection(
  input: { lastInspectedAt: string | null; frequency: string | null },
  today: string,
  dueWindowDays = 7,
): {
  status: VehicleInspectionStatus;
  lastInspectedAt: string | null;
  nextDueAt: string | null;
} {
  const { lastInspectedAt, frequency } = input;
  if (!lastInspectedAt) return { status: "none", lastInspectedAt: null, nextDueAt: null };
  const days =
    frequency && frequency in INSPECTION_FREQUENCY_DAYS
      ? INSPECTION_FREQUENCY_DAYS[frequency as InspectionFrequency]
      : null;
  if (days == null) return { status: "regular", lastInspectedAt, nextDueAt: null };
  const nextDueAt = addDaysIso(lastInspectedAt, days);
  const validity: DocumentValidityStatus = classifyDocumentValidity(nextDueAt, {
    today,
    dueWindowDays,
  });
  const status: VehicleInspectionStatus =
    validity === "expired" ? "expired" : validity === "due_soon" ? "due_soon" : "regular";
  return { status, lastInspectedAt, nextDueAt };
}

/** Formata a placa para exibição inserindo hífen após os 3 primeiros caracteres
 *  (AAA0000 → AAA-0000, AAA0A00 → AAA-0A00). Armazenamento continua normalizado. */
export function formatPlate(plate: string): string {
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p.length === 7 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
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

const optionalYear = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().int().min(1900).max(2100).optional(),
);

const optionalFrequency = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  inspectionFrequencySchema.optional(),
);

export const vehicleInputSchema = z.object({
  plate: plateSchema,
  renavam: optionalString,
  brand: optionalString,
  model: optionalString,
  type: optionalVehicleType,
  year: optionalYear,
  color: optionalString,
  owner: optionalString,
  companyId: optionalUuid.nullable().optional(),
  workUnitId: optionalUuid.nullable().optional(),
  inspectionPlanId: optionalUuid.nullable().optional(),
  inspectionFrequency: optionalFrequency,
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

export const vehicleFiltersSchema = z
  .object({
    search: z.string().trim().optional(),
    companyId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).optional(),
  })
  .strict();
export type VehicleFilters = z.infer<typeof vehicleFiltersSchema>;

export type VehicleListItem = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  typeLabel: string;
  year: number | null;
  owner: string | null;
  initialKm: number;
  companyName: string | null;
  lastInspectedAt: string | null;
  inspectionStatus: VehicleInspectionStatus;
  inspectionStatusLabel: string;
};

export function toVehicleListItem(
  row: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    type: string | null;
    year: number | null;
    owner: string | null;
    initialKm: number;
    companyName: string | null;
    lastInspectedAt: string | null;
    inspectionFrequency: string | null;
  },
  today: string,
): VehicleListItem {
  const { status } = classifyVehicleInspection(
    { lastInspectedAt: row.lastInspectedAt, frequency: row.inspectionFrequency },
    today,
  );
  return {
    id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    type: row.type,
    typeLabel: vehicleTypeLabel(row.type),
    year: row.year,
    owner: row.owner,
    initialKm: row.initialKm,
    companyName: row.companyName,
    lastInspectedAt: row.lastInspectedAt,
    inspectionStatus: status,
    inspectionStatusLabel: VEHICLE_INSPECTION_STATUS_LABELS[status],
  };
}
