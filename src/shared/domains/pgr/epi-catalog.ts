import { z } from "zod";

import type { EpiCatalog } from "@/shared/db/schema/epis";

import {
  optionalIsoDate,
  optionalString,
  requiredString,
  requiredUuid,
} from "./form-fields";
import { categoryTypeSchema, type CategoryType } from "./validation";

export type { EpiCatalog, CategoryType };

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
  name: requiredString("Nome é obrigatório"),
  ca: optionalString,
  caValidUntil: optionalIsoDate,
  manufacturer: optionalString,
  norm: optionalString,
  size: optionalString,
  unitOfMeasure: optionalString,
  description: optionalString,
  photoPath: optionalString,
});

export type EpiCatalogInput = z.input<typeof epiCatalogInputSchema>;
export type EpiCatalogValues = z.output<typeof epiCatalogInputSchema>;

/**
 * DTO de listagem: item + nome da categoria associada (do join escopado por
 * tenant, ver `repositories/epi-catalog.ts`). O rótulo de tipo
 * (`epi → EPI`, `machine → Máquinas e Equipamentos`) é formatado na UI, não aqui.
 */
export type EpiCatalogListItem = EpiCatalog & { categoryName: string };
