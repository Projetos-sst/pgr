/**
 * Tipos do vertical CAEPI. Sem `server-only` de propósito: `CaLookupResult` é
 * consumido também pelo hook client, e `CaepiParsedRow` pelo script de ingestão.
 */

/** Linha tipada que sai do parse do CSV oficial (validada por Zod). */
export type CaepiParsedRow = {
  /** Só dígitos, não vazio. */
  ca: string;
  /** YYYY-MM-DD (convertida de dd/mm/aaaa). */
  validUntil: string;
  /** Situação crua do MTE (VÁLIDO, VENCIDO, …). */
  situation: string;
  manufacturerName: string | null;
  manufacturerCnpj: string | null;
  equipmentName: string | null;
  description: string | null;
  nature: string | null;
  norms: string | null;
};

/**
 * Contrato de saída da consulta de CA — união fechada de 3 estados (FR-004).
 * Todo desfecho é payload (nunca erro): a UI transforma em aviso e o cadastro
 * de EPI jamais é bloqueado.
 */
export type CaLookupResult =
  | {
      status: "valid";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | {
      status: "expired";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | { status: "not_found"; ca: string; baseUnsynced?: boolean };
