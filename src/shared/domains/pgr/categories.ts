import { z } from "zod";

import type { Category } from "@/shared/db/schema/categories";

import { optionalString, requiredString } from "./form-fields";
import { categoryTypeSchema, type CategoryType } from "./validation";

export type { Category, CategoryType };

/** Booleano vindo de form (`"true"`/`"false"`) ou JSON (boolean); default `true`. */
const activeFromForm = z.preprocess(
  (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : v),
  z.boolean().default(true),
);

export const categoryInputSchema = z.object({
  type: categoryTypeSchema,
  name: requiredString("Nome é obrigatório"),
  note: optionalString,
  isActive: activeFromForm,
});

export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryValues = z.output<typeof categoryInputSchema>;

/**
 * DTO de listagem: `Category` + `itemCount` (nº de itens vinculados, derivado na
 * leitura). O rótulo de tipo (`epi → EPI`, etc.) é formatado na UI.
 */
export type CategoryListItem = Category & { itemCount: number };

/** Rótulos pt-BR do tipo de categoria (inclui Insumo/#192). */
export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  epi: "EPI",
  machine: "Máquina",
  supply: "Insumo",
};
