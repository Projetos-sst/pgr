import { fetchBrasilApiCnpj } from "./providers/brasilapi";
import { TtlCache } from "./cache";
import type { CnpjCompany, ProviderResult } from "./providers/types";
import { normalizeCnpj } from "./validation";

const CNPJ_TTL_MS = 1000 * 60 * 60 * 24 * 7; // ~7 dias: situação cadastral muda.
const cache = new TtlCache<CnpjCompany>(CNPJ_TTL_MS);

/** Consulta de CNPJ com cache de sucesso. `cnpj` já deve ter passado por `isValidCnpj`. */
export async function lookupCnpj(cnpj: string): Promise<ProviderResult<CnpjCompany>> {
  const key = normalizeCnpj(cnpj);
  const cached = cache.get(key);
  if (cached) return { ok: true, data: cached };

  const result = await fetchBrasilApiCnpj(key);
  if (result.ok) cache.set(key, result.data);
  return result;
}

/** Uso em testes: limpa o cache entre casos. */
export function clearCnpjCache(): void {
  cache.clear();
}
