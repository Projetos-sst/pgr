import { z } from "zod";

import type { EpiCatalog } from "@/shared/db/schema/epis";

import {
  optionalIsoDate,
  optionalString,
  optionalUuid,
  requiredString,
  requiredUuid,
} from "./form-fields";
import { categoryTypeSchema, type CategoryType } from "./validation";

export type { EpiCatalog, CategoryType };

/** Inteiro positivo opcional vindo de form (string vazia → undefined). Vida útil (meses). */
const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

/**
 * Entrada do CRUD de `epi_catalog`. `type` e `categoryId` definem a referência à
 * categoria (a coerência tenant+tipo é garantida no repositório por
 * `assertCategoryInTenant` + FK composta). Campos seguem o schema real da 008:
 * `norm` (Norma), `caValidUntil` (validade do CA), `photoPath` (caminho textual,
 * sem upload). Sem unicidade (FR-017).
 */
export const epiCatalogInputSchema = z.object({
  type: categoryTypeSchema,
  categoryId: requiredUuid("Categoria é obrigatória"),
  // Empresa do EPI (#201, R1) — opcional (nullable no banco).
  companyId: optionalUuid,
  usefulLifeMonths: optionalPositiveInt,
  name: requiredString("Nome é obrigatório"),
  ca: optionalString,
  caValidUntil: optionalIsoDate,
  manufacturer: optionalString,
  norm: optionalString,
  // Material do item (issue #29) — complementa CA/norma nas especificações técnicas.
  material: optionalString,
  size: optionalString,
  unitOfMeasure: optionalString,
  description: optionalString,
  photoPath: optionalString,
  // Data de substituição programada do item (issue #24) — mesmo formato/padrão
  // de `caValidUntil` (data ISO opcional, string vazia → undefined).
  replacementDate: optionalIsoDate,
});

export type EpiCatalogInput = z.input<typeof epiCatalogInputSchema>;
export type EpiCatalogValues = z.output<typeof epiCatalogInputSchema>;

/**
 * `createdBy` (issue #27) NUNCA é aceito do cliente — não faz parte do schema
 * de entrada. É preenchido pelo repositório a partir do `userId` da sessão,
 * só no `create` (imutável em updates, ver `repositories/epi-catalog.ts`).
 */

// ---------------------------------------------------------------------------
// Auditoria (issue #25): resumo textual do diff entre o estado antigo e novo
// de um item, gravado em `epi_catalog_audit_log` a cada create/update.
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<CategoryType, string> = {
  epi: "EPI",
  machine: "Máquinas e Equipamentos",
  supply: "Insumo",
};

/** Campos de negócio auditados, na ordem em que aparecem no resumo. */
const AUDIT_FIELD_LABELS = {
  type: "tipo",
  categoryId: "categoria",
  name: "nome",
  ca: "CA",
  caValidUntil: "validade do CA",
  manufacturer: "fabricante",
  norm: "norma",
  material: "material",
  size: "tamanho",
  unitOfMeasure: "unidade de medida",
  description: "descrição",
  photoPath: "foto",
  replacementDate: "data de substituição",
} as const;

export type EpiCatalogAuditSnapshot = Pick<EpiCatalog, keyof typeof AUDIT_FIELD_LABELS>;

function displayValue(field: keyof EpiCatalogAuditSnapshot, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "type") return TYPE_LABELS[value as CategoryType] ?? String(value);
  return String(value);
}

/**
 * Gera o resumo textual (pt-BR) do diff entre `before` e `after` — usado como
 * `summary` do `epi_catalog_audit_log`. `categoryNames`, quando informado,
 * resolve `categoryId` para o nome legível da categoria (o repositório busca
 * os nomes; esta função é pura e não toca o banco).
 */
export function summarizeEpiCatalogChanges(
  before: EpiCatalogAuditSnapshot,
  after: EpiCatalogAuditSnapshot,
  categoryNames: { old?: string; new?: string } = {},
): string {
  const changes: string[] = [];
  for (const field of Object.keys(
    AUDIT_FIELD_LABELS,
  ) as (keyof EpiCatalogAuditSnapshot)[]) {
    const prev = before[field];
    const next = after[field];
    if (prev === next) continue;
    const label = AUDIT_FIELD_LABELS[field];
    if (field === "categoryId") {
      const prevLabel = categoryNames.old ?? displayValue(field, prev);
      const nextLabel = categoryNames.new ?? displayValue(field, next);
      changes.push(`${label} de "${prevLabel}" para "${nextLabel}"`);
      continue;
    }
    changes.push(
      `${label} de "${displayValue(field, prev)}" para "${displayValue(field, next)}"`,
    );
  }
  if (changes.length === 0) return "Item salvo sem alterações de dados.";
  return `Alterou ${changes.join(", ")}.`;
}

/** Resumo fixo do `create` (não há "antes" para comparar). */
export const EPI_CATALOG_CREATED_SUMMARY = "Item cadastrado.";

/**
 * DTO de listagem: item + nome da categoria associada (do join escopado por
 * tenant, ver `repositories/epi-catalog.ts`). O rótulo de tipo
 * (`epi → EPI`, `machine → Máquinas e Equipamentos`) é formatado na UI, não aqui.
 */
export type EpiCatalogListItem = EpiCatalog & { categoryName: string };
