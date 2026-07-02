import "server-only";

import { getByCa, type CaepiCertificate } from "@/shared/db/repositories/caepi";

import { validateCa, todayInSaoPaulo } from "./validate-ca";
import type { CaLookupResult } from "./types";

function toFoundResult(
  status: "valid" | "expired",
  record: CaepiCertificate,
): CaLookupResult {
  return {
    status,
    ca: record.ca,
    manufacturer: record.manufacturerName ?? "",
    norm: record.norms ?? "",
    validUntil: record.validUntil,
    ...(record.equipmentName ? { equipmentName: record.equipmentName } : {}),
  };
}

/**
 * Consulta 100% local (Inv-1): 1 SELECT por PK, nenhuma chamada externa. Serviço
 * único consumido pela Server Action e pelo Route Handler. `ca` já chega
 * validado/normalizado pela surface. Nunca lança por "não encontrado" — todo
 * desfecho é um estado do contrato `CaLookupResult`.
 */
export async function lookupCaRecord(ca: string): Promise<CaLookupResult> {
  const result = await getByCa(ca);
  if (result.record === null) {
    return {
      status: "not_found",
      ca,
      ...(result.baseEmpty ? { baseUnsynced: true } : {}),
    };
  }
  return toFoundResult(validateCa(result.record, todayInSaoPaulo()), result.record);
}
