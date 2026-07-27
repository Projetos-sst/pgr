import { z } from "zod";

import {
  optionalIsoDate,
  optionalString,
  requiredUuid,
} from "@/shared/domains/pgr/form-fields";
import type { Accident } from "@/shared/db/schema";

import {
  incidentStatusLabel,
  incidentStatusSchema,
  type IncidentStatus,
} from "./incident-lifecycle";

/**
 * Domínio de Incidentes/Acidentes (Fase 06 / US4). Enums **fechados** (sem lookup externo);
 * campos código/descrição CAT e `cat_number`/`cat_issued_at` são **textuais e opcionais**
 * (registro **interno**, sem S-2210/`esocial_events`). `org_id`/timestamps/status são
 * server-only e nunca aceitos do cliente. Dado de saúde é P0 (só office staff).
 */

// ── Enums fechados (espelham pgEnum do schema) ─────────────────────────────────

export const accidentTypeSchema = z.enum(["typical", "commute", "occupational_disease"]);
export type AccidentType = z.infer<typeof accidentTypeSchema>;

export const accidentCategorySchema = z.enum(["with_leave", "without_leave", "fatal"]);
export type AccidentCategory = z.infer<typeof accidentCategorySchema>;

export const accidentSeveritySchema = z.enum(["minor", "moderate", "severe", "fatal"]);
export type AccidentSeverity = z.infer<typeof accidentSeveritySchema>;

export const ACCIDENT_TYPE_LABELS: Record<AccidentType, string> = {
  typical: "Típico",
  commute: "Trajeto",
  occupational_disease: "Doença ocupacional",
};

export const ACCIDENT_CATEGORY_LABELS: Record<AccidentCategory, string> = {
  with_leave: "Com afastamento",
  without_leave: "Sem afastamento",
  fatal: "Óbito",
};

export const ACCIDENT_SEVERITY_LABELS: Record<AccidentSeverity, string> = {
  minor: "Leve",
  moderate: "Moderada",
  severe: "Grave",
  fatal: "Fatal",
};

export function accidentTypeLabel(value: string | null): string {
  if (!value) return "—";
  return ACCIDENT_TYPE_LABELS[value as AccidentType] ?? value;
}

export function accidentCategoryLabel(value: string | null): string {
  if (!value) return "—";
  return ACCIDENT_CATEGORY_LABELS[value as AccidentCategory] ?? value;
}

export function accidentSeverityLabel(value: string | null): string {
  if (!value) return "—";
  return ACCIDENT_SEVERITY_LABELS[value as AccidentSeverity] ?? value;
}

// ── Campos reutilizados ─────────────────────────────────────────────────────────

export const MAX_NARRATIVE = 5000;

/** Data/hora da ocorrência (timestamptz). Aceita ISO com ou sem offset; valida parse. */
const occurredAtField = z
  .string({ error: "Data/hora da ocorrência é obrigatória" })
  .trim()
  .min(1, "Data/hora da ocorrência é obrigatória")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data/hora da ocorrência inválida");

/** Texto narrativo opcional com teto defensivo (evita payload gigante). */
const narrative = z
  .string()
  .trim()
  .max(MAX_NARRATIVE, `Texto deve ter no máximo ${MAX_NARRATIVE} caracteres`)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalBoolean = z.boolean().optional();
const optionalHours = z.coerce
  .number()
  .min(0, "Horas trabalhadas não pode ser negativa")
  .optional();

// Bloco reutilizado por create/update: todos os campos de conteúdo do incidente exceto
// os server-only (`status`/timestamps/`completion_justification`, que só mudam por transição).
const accidentContentShape = {
  companyId: requiredUuid("Empresa é obrigatória"),
  employeeId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    requiredUuid("Funcionário inválido").optional(),
  ),
  occurredAt: occurredAtField,
  type: accidentTypeSchema,
  category: accidentCategorySchema,
  severity: accidentSeveritySchema,
  location: narrative,
  description: narrative,
  awayFromWork: optionalBoolean,
  workedHours: optionalHours,
  hospital: narrative,
  injuryNatureCode: optionalString,
  injuryNatureDescription: narrative,
  bodyPartCode: optionalString,
  bodyPartDescription: narrative,
  causativeAgentCode: optionalString,
  causativeAgentDescription: narrative,
  causes: narrative,
  environmentalImpact: narrative,
  materialLoss: narrative,
  thirdParties: narrative,
  fatalityPotential: optionalBoolean,
  responsibleArea: narrative,
  activityProcedure: narrative,
  witnesses: narrative,
  investigationNotes: narrative,
  catNumber: optionalString,
  catIssuedAt: optionalIsoDate,
} as const;

// ── Create / Update ─────────────────────────────────────────────────────────────

/**
 * Criação. `status` inicial é sempre `registered` (definido no servidor); `org_id`,
 * timestamps e `completion_justification` nunca vêm do cliente.
 */
export const accidentCreateSchema = z.object(accidentContentShape).strict();
export type AccidentCreateInput = z.input<typeof accidentCreateSchema>;
export type AccidentCreateValues = z.output<typeof accidentCreateSchema>;

/**
 * Atualização de conteúdo. Preserva `id`/`org_id`/`created_at`/`status`: a mudança de
 * status ocorre **somente** pela transição dedicada (`setAccidentStatus`), não por aqui.
 */
export const accidentUpdateSchema = z.object(accidentContentShape).strict();
export type AccidentUpdateInput = z.input<typeof accidentUpdateSchema>;
export type AccidentUpdateValues = z.output<typeof accidentUpdateSchema>;

// ── Transição de estado / conclusão ──────────────────────────────────────────────

/**
 * Transição de estado explícita. A legalidade e a exigência de justificativa vivem em
 * `incident-lifecycle.ts` (fonte única); aqui só validamos o shape de entrada.
 */
export const accidentStatusTransitionSchema = z
  .object({
    status: incidentStatusSchema,
    justification: optionalString,
  })
  .strict();
export type AccidentStatusTransitionInput = z.input<
  typeof accidentStatusTransitionSchema
>;
export type AccidentStatusTransitionValues = z.output<
  typeof accidentStatusTransitionSchema
>;

// ── Filtros / paginação ───────────────────────────────────────────────────────

export const accidentFiltersSchema = z
  .object({
    status: incidentStatusSchema.optional(),
    type: accidentTypeSchema.optional(),
    category: accidentCategorySchema.optional(),
    severity: accidentSeveritySchema.optional(),
    companyId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    occurredFrom: z.iso.date().optional(),
    occurredTo: z.iso.date().optional(),
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).optional(),
  })
  .strict();
export type AccidentFilters = z.infer<typeof accidentFiltersSchema>;

// ── View models ──────────────────────────────────────────────────────────────

/**
 * Item de listagem. NÃO carrega dado de saúde/investigação (hospital, lesão, testemunhas,
 * descrição narrativa) — apenas classificação e identificação para a tabela protegida.
 */
export type AccidentListItem = {
  id: string;
  occurredAt: string;
  type: string;
  typeLabel: string;
  category: string;
  categoryLabel: string;
  severity: string;
  severityLabel: string;
  status: string;
  statusLabel: string;
  companyName: string | null;
  location: string | null;
  catNumber: string | null;
};

export function toAccidentListItem(row: {
  id: string;
  occurredAt: Date;
  type: string;
  category: string;
  severity: string;
  status: string;
  companyName: string | null;
  location: string | null;
  catNumber: string | null;
}): AccidentListItem {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    type: row.type,
    typeLabel: accidentTypeLabel(row.type),
    category: row.category,
    categoryLabel: accidentCategoryLabel(row.category),
    severity: row.severity,
    severityLabel: accidentSeverityLabel(row.severity),
    status: row.status,
    statusLabel: incidentStatusLabel(row.status),
    companyName: row.companyName,
    location: row.location,
    catNumber: row.catNumber,
  };
}

export type { Accident, IncidentStatus };
