/**
 * Validação e normalização de CEP/CNPJ — lógica pura compartilhada entre o cliente
 * (hooks decidem se disparam o lookup) e o servidor (route handler barra formato
 * inválido antes de chamar o provider externo). Sem `server-only` de propósito.
 */

/** Mantém apenas dígitos (remove máscara, espaços e separadores). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export const normalizeCep = onlyDigits;
export { normalizeCnpj, isValidCnpj } from "@/shared/domains/pgr/cnpj";

/** CEP válido = exatamente 8 dígitos após remover a máscara. */
export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}
