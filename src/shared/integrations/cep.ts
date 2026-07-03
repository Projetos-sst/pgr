import { TtlCache } from "./cache";
import { fetchViaCep } from "./providers/viacep";
import type { CepAddress, ProviderResult } from "./providers/types";
import { normalizeCep } from "./validation";

const CEP_TTL_MS = 1000 * 60 * 60 * 24 * 30; // ~30 dias: CEP muda raramente.
const cache = new TtlCache<CepAddress>(CEP_TTL_MS);

/** Consulta de CEP com cache de sucesso. `cep` já deve ter passado por `isValidCep`. */
export async function lookupCep(cep: string): Promise<ProviderResult<CepAddress>> {
  const key = normalizeCep(cep);
  const cached = cache.get(key);
  if (cached) return { ok: true, data: cached };

  const result = await fetchViaCep(key);
  if (result.ok) cache.set(key, result.data);
  return result;
}

/** Uso em testes: limpa o cache entre casos. */
export function clearCepCache(): void {
  cache.clear();
}
