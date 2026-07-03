/**
 * Normalização/validação do nº de CA — lógica pura compartilhada entre o cliente
 * (hook decide se dispara o lookup) e o servidor (surfaces barram formato inválido
 * antes de tocar a base). Sem `server-only` de propósito (padrão validation.ts).
 */
import { onlyDigits } from "../validation";

/** Valor canônico consultado/armazenado: só dígitos, sem strip de zeros à esquerda. */
export const normalizeCa = onlyDigits;

const MAX_CA_DIGITS = 10;

/**
 * CA válido = 1 a 10 dígitos após remover máscara/espaços, e o original não
 * contém letras (aceita pontuação leve de máscara). O MTE não publica dígito
 * verificador nem tamanho fixo — teto folgado para numeração futura.
 */
export function isValidCa(value: string): boolean {
  if (/[a-zA-Z]/.test(value)) return false;
  const digits = normalizeCa(value);
  return digits.length >= 1 && digits.length <= MAX_CA_DIGITS;
}
