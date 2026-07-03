"use client";

import type { CnpjCompany } from "../providers/types";
import { isValidCnpj, normalizeCnpj } from "../validation";
import { useLookup, type LookupApi } from "./use-lookup";

const buildUrl = (value: string) => `/api/integrations/cnpj/${normalizeCnpj(value)}`;

/** Autocompleta dados cadastrais da empresa a partir do CNPJ (dispara no blur). */
export function useCnpjLookup(
  onFound: (company: CnpjCompany) => void,
): LookupApi<CnpjCompany> {
  return useLookup<CnpjCompany>({ isValid: isValidCnpj, buildUrl, onFound });
}
