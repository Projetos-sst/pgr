/**
 * Montagem da cadeia de modelos — **pura** (sem `server-only`, sem leitura de ambiente):
 * recebe os valores já lidos e devolve a lista de candidatos na ordem de tentativa.
 * Fica fora de `config.ts` para ser coberta por teste unitário.
 */

/** Prefixo do roteador de modelos do Mastra que endereça a OpenRouter. */
const OPENROUTER_PREFIX = "openrouter";

export type ModelCandidate = { model: string; maxRetries: number };

/**
 * Primário seguido dos fallbacks, sem repetição e sem entrada vazia. Um modelo que
 * apareça nos dois lugares é mantido só na primeira posição — repetir não adiciona
 * resiliência, só gasta o tempo do usuário tentando de novo o que acabou de falhar.
 *
 * O prefixo do roteador é aplicado aqui, então o `.env` guarda o id como ele aparece no
 * catálogo da OpenRouter (`vendor/modelo:free`), sem detalhe do framework.
 */
export function buildModelChain(
  primary: string,
  fallbacks: readonly string[],
  maxRetries: number,
): ModelCandidate[] {
  const seen = new Set<string>();
  const chain: ModelCandidate[] = [];

  for (const raw of [primary, ...fallbacks]) {
    const model = raw.trim();
    if (model === "" || seen.has(model)) continue;
    seen.add(model);
    chain.push({ model: `${OPENROUTER_PREFIX}/${model}`, maxRetries });
  }
  return chain;
}

/** Lista separada por vírgula vinda do ambiente → array limpo. Vazio → `null`. */
export function parseModelList(raw: string | undefined): string[] | null {
  const items = (raw ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m !== "");
  return items.length > 0 ? items : null;
}
