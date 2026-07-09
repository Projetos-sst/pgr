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
export const normalizeCnpj = onlyDigits;

/** CEP válido = exatamente 8 dígitos após remover a máscara. */
export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

function cnpjCheckDigit(base: string): number {
  let sum = 0;
  let weight = base.length - 7;
  for (const char of base) {
    sum += Number(char) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * CNPJ válido = 14 dígitos + dígitos verificadores (módulo 11). Rejeita sequências
 * repetidas (`00000000000000`), que passam no cálculo mas não são CNPJs reais.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const firstDigit = cnpjCheckDigit(cnpj.slice(0, 12));
  if (firstDigit !== Number(cnpj[12])) return false;

  const secondDigit = cnpjCheckDigit(cnpj.slice(0, 13));
  return secondDigit === Number(cnpj[13]);
}
