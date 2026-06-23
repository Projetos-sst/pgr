import { z } from "zod";

import type { Category } from "@/shared/db/schema/categories";

import { optionalString, requiredString } from "./form-fields";
import { categoryTypeSchema, type CategoryType } from "./validation";

export type { Category, CategoryType };

export const categoryInputSchema = z.object({
  type: categoryTypeSchema,
  name: requiredString("Nome é obrigatório"),
  note: optionalString,
});

export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryValues = z.output<typeof categoryInputSchema>;

/**
 * DTO de listagem: `CategoryListItem = Category` (sem mapeador no domínio).
 * O rótulo de tipo (`epi → EPI`, `machine → Máquina`) é formatado na UI, não aqui.
 */
export type CategoryListItem = Category;
