"use client";

import type { CepAddress } from "../providers/types";
import { isValidCep, normalizeCep } from "../validation";
import { useLookup, type LookupApi } from "./use-lookup";

const buildUrl = (value: string) => `/api/integrations/cep/${normalizeCep(value)}`;

/** Autocompleta endereço a partir do CEP (dispara no blur do campo). */
export function useCepLookup(
  onFound: (address: CepAddress) => void,
): LookupApi<CepAddress> {
  return useLookup<CepAddress>({ isValid: isValidCep, buildUrl, onFound });
}
