import "server-only";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

/**
 * Modelo default dos agentes (identificador no catálogo da OpenRouter). Escolhido entre os
 * modelos **gratuitos** com suporte a tool calling, priorizando latência: responde o tool call
 * 5W2H completo em ~1,5–2,5s. Trocar é só `AI_SUGGESTION_MODEL` — o código não depende do modelo.
 */
export const DEFAULT_AI_MODEL = "minimax/minimax-m3:free";

/** Base URL default da OpenRouter (API compatível com OpenAI Chat Completions). */
export const DEFAULT_AI_BASE_URL = "https://openrouter.ai/api/v1";

export function getAiModel(): string {
  return process.env.AI_SUGGESTION_MODEL?.trim() || DEFAULT_AI_MODEL;
}

/**
 * Base URL do provedor. Em produção fica ausente → OpenRouter real. Só é definida em
 * ambientes de teste/E2E para apontar a um mock local (nunca chama a OpenRouter real),
 * sem qualquer ramo específico de teste no código de produto.
 */
export function getAiBaseUrl(): string {
  const raw = process.env.OPENROUTER_BASE_URL?.trim();
  return (raw || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

/**
 * Chave da API do provedor — **somente servidor**. Ausente → `AI_UNAVAILABLE` com a
 * mensagem **genérica** do erro: `AppError.message` é devolvida ao cliente por
 * `toActionError`, então citar o provedor ou o nome da variável aqui expõe a nossa
 * infraestrutura na tela do usuário. O motivo real vai para o log do servidor.
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
