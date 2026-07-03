"use client";

import { useLookup } from "@/shared/integrations/client/use-lookup";

import { isValidCa, normalizeCa } from "../normalize";
import type { CaLookupResult } from "../types";

export type CaepiValidationStatus =
  | "idle"
  | "loading"
  | "valid"
  | "expired"
  | "not_found"
  | "error";

export type CaFound = Extract<CaLookupResult, { status: "valid" | "expired" }>;

export type CaepiValidationApi = {
  status: CaepiValidationStatus;
  data?: CaLookupResult;
  lookup: (ca: string) => void;
};

const buildUrl = (value: string) => `/api/integrations/caepi/${normalizeCa(value)}`;

/**
 * Wrapper do `useLookup` (herda: dispara só com formato válido, aborta a
 * requisição anterior, nunca lança — falha externa vira `error` silencioso).
 * O REST devolve os 3 estados como payload 200, então o status exposto é
 * derivado do `status` do payload. `onFound` é chamado em `valid` E `expired`
 * (autofill acontece nos dois — FR-061), nunca em `not_found`.
 */
export function useCaepiValidation(onFound: (data: CaFound) => void): CaepiValidationApi {
  const { status, data, lookup } = useLookup<CaLookupResult>({
    isValid: isValidCa,
    buildUrl,
    onFound: (result) => {
      if (result.status === "valid" || result.status === "expired") onFound(result);
    },
  });

  const derivedStatus: CaepiValidationStatus =
    status === "success" && data ? data.status : status === "success" ? "error" : status;

  return { status: derivedStatus, data, lookup };
}
