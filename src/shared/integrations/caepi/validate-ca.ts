/**
 * Derivação pura do estado de vigência de um CA (research R6). Sem `server-only`
 * de propósito: função pura, testável em unit sem ambiente React Server.
 */

export type CaValidity = "valid" | "expired";

type ValidatableRecord = {
  /** YYYY-MM-DD */
  validUntil: string;
  /** Situação crua do MTE (VÁLIDO, VENCIDO, CANCELADO, …). */
  situation: string;
};

const VALID_SITUATION = "VALIDO";

/** Uppercase + NFD sem acentos: `VÁLIDO` → `VALIDO` (não depende da grafia da fonte). */
function normalizeSituation(situation: string): string {
  return situation
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * `valid` ⇔ situação normalizada = VALIDO **e** `validUntil >= today` (inclusivo:
 * `== today` é `valid`). Qualquer outra combinação — inclusive situação
 * desconhecida — é `expired` (conservador: nunca selo verde indevido).
 * Comparação lexicográfica de `YYYY-MM-DD`.
 */
export function validateCa(record: ValidatableRecord, today: string): CaValidity {
  const isSituationValid = normalizeSituation(record.situation) === VALID_SITUATION;
  return isSituationValid && record.validUntil >= today ? "valid" : "expired";
}

export { todayInSaoPaulo } from "@/shared/dates";
