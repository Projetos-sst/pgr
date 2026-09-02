import "server-only";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { buildModelChain, parseModelList, type ModelCandidate } from "./core/model-chain";

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
 * Cadeia de fallback default, na ordem de tentativa. O Mastra troca de modelo sozinho
 * quando o anterior esgota os retries (429, timeout, 5xx) — é o que mantém a feature de pé
 * no tier gratuito, onde indisponibilidade momentânea é a regra e não a exceção. Ambos
 * foram verificados produzindo 5W2H válido para o schema do domínio.
 */
export const DEFAULT_FALLBACK_AI_MODELS = [
  "cohere/north-mini-code:free",
  "minimax/minimax-m2.7:free",
];

/** Tentativas por modelo antes de cair para o próximo da cadeia. */
export const DEFAULT_MAX_RETRIES_PER_MODEL = 2;

export type { ModelCandidate };

/**
 * Cadeia de modelos pronta para o `Agent` do Mastra. Tudo vem do ambiente, com default
 * medido para o tier gratuito:
 *
 * - `AI_SUGGESTION_MODEL`     modelo primário (id do catálogo da OpenRouter)
 * - `AI_FALLBACK_MODELS`      fallbacks separados por vírgula, na ordem de tentativa
 * - `AI_MAX_RETRIES_PER_MODEL` tentativas por modelo antes de cair para o próximo
 */
export function resolveModelChain(): ModelCandidate[] {
  const primary = process.env.AI_SUGGESTION_MODEL?.trim() || DEFAULT_AI_MODEL;
  const fallbacks =
    parseModelList(process.env.AI_FALLBACK_MODELS) ?? DEFAULT_FALLBACK_AI_MODELS;

  const configured = Number(process.env.AI_MAX_RETRIES_PER_MODEL);
  const maxRetries =
    Number.isInteger(configured) && configured >= 0
      ? configured
      : DEFAULT_MAX_RETRIES_PER_MODEL;

  return buildModelChain(primary, fallbacks, maxRetries);
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
