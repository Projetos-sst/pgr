import "server-only";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { buildModelChain, type ModelCandidate } from "./core/model-chain";

/**
 * Configuração do runtime de IA: quais modelos os agentes usam e em que ordem. Tudo é
 * configurável por ambiente e lido **a cada execução** (não em módulo), para que trocar
 * de modelo não exija rebuild e para que a chave ausente falhe na chamada, não no import.
 */

/**
 * Modelo primário default — gratuito no catálogo da OpenRouter. Escolhido medindo os free
 * com suporte a saída estruturada: foi o mais rápido (~5–12s) e o mais disponível.
 */
export const DEFAULT_AI_MODEL = "minimax/minimax-m3:free";

/**
 * Fallback default. **Um só**, de propósito: o que derruba a chamada no tier gratuito é
 * indisponibilidade momentânea de um modelo, e o segundo já cobre isso — o Mastra troca
 * sozinho quando o primeiro esgota os retries (429, timeout, 5xx). Verificado produzindo
 * 5W2H válido para o schema do domínio.
 */
export const DEFAULT_FALLBACK_AI_MODEL = "cohere/north-mini-code:free";

/** Tentativas por modelo antes de cair para o fallback. Constante: não é ajuste de operação. */
export const MAX_RETRIES_PER_MODEL = 2;

export type { ModelCandidate };

/**
 * Cadeia de modelos pronta para o `Agent` do Mastra: primário e fallback, ambos vindos do
 * ambiente com default medido para o tier gratuito.
 *
 * - `AI_SUGGESTION_MODEL` modelo primário (id do catálogo da OpenRouter)
 * - `AI_FALLBACK_MODEL`   modelo usado quando o primário esgota os retries
 */
export function resolveModelChain(): ModelCandidate[] {
  return buildModelChain(
    process.env.AI_SUGGESTION_MODEL?.trim() || DEFAULT_AI_MODEL,
    process.env.AI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_AI_MODEL,
    MAX_RETRIES_PER_MODEL,
  );
}

/**
 * Chave da API do provedor — **somente servidor**. Ausente → `AI_UNAVAILABLE` com a
 * mensagem **genérica** do erro: `AppError.message` é devolvida ao cliente por
 * `toActionError`, então citar o provedor ou o nome da variável aqui expõe a nossa
 * infraestrutura na tela do usuário. O motivo real vai para o log do servidor.
 *
 * O roteador do Mastra lê `OPENROUTER_API_KEY` do ambiente por conta própria; a checagem
 * explícita existe para falhar com a nossa mensagem em vez do erro cru do framework.
 */
export function requireOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    console.error(
      "[agents] OPENROUTER_API_KEY ausente — sugestões por IA desabilitadas.",
    );
    throw new AiUnavailableError();
  }
  return key;
}
