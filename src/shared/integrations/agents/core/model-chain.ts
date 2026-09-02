/**
 * Montagem da cadeia de modelos — **pura** (sem `server-only`, sem leitura de ambiente):
 * recebe os valores já lidos e devolve a lista de candidatos na ordem de tentativa.
 * Fica fora de `config.ts` para ser coberta por teste unitário.
 */

/** Prefixo do roteador de modelos do Mastra que endereça a OpenRouter. */
const OPENROUTER_PREFIX = "openrouter";

export type ModelCandidate = { model: string; maxRetries: number };

/**
 * Primário seguido do fallback, sem repetição e sem entrada vazia. Se os dois apontarem
 * para o mesmo modelo, ele é mantido só na primeira posição — repetir não adiciona
 * resiliência, só gasta o tempo do usuário tentando de novo o que acabou de falhar.
 *
 * Um fallback basta: o que derruba a chamada no tier gratuito é indisponibilidade
 * momentânea de um modelo, e o segundo já cobre isso. Encadear mais só somava latência
 * ao caso em que o provedor inteiro está fora.
 *
 * O prefixo do roteador é aplicado aqui, então o `.env` guarda o id como ele aparece no
 * catálogo da OpenRouter (`vendor/modelo:free`), sem detalhe do framework.
 */
export function buildModelChain(
  primary: string,
  fallback: string,
  maxRetries: number,
): ModelCandidate[] {
  const seen = new Set<string>();
  const chain: ModelCandidate[] = [];

  for (const raw of [primary, fallback]) {
    const model = raw.trim();
    if (model === "" || seen.has(model)) continue;
    seen.add(model);
    chain.push({ model: `${OPENROUTER_PREFIX}/${model}`, maxRetries });
  }
  return chain;
}
