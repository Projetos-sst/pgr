import "server-only";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

/** Modelo default da sugestão de riscos (Anthropic/Claude). */
export const DEFAULT_AI_MODEL = "claude-opus-4-8";

export function getAiModel(): string {
  return process.env.AI_SUGGESTION_MODEL?.trim() || DEFAULT_AI_MODEL;
}

/**
 * Base URL opcional do provedor (config padrão do SDK Anthropic). **Ausente em produção**
 * → API real. Só é definida em ambientes de teste/E2E para apontar a um mock local
 * (nunca chama a Anthropic real), sem qualquer ramo específico de teste no código de produto.
 */
export function getAiBaseUrl(): string | undefined {
  const raw = process.env.ANTHROPIC_BASE_URL?.trim();
  return raw ? raw : undefined;
}

/**
 * Chave da API Anthropic — **somente servidor**. Ausente → `AI_UNAVAILABLE`
 * (nunca vaza para o cliente; nunca bloqueia o cadastro manual).
 */
export function requireAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AiUnavailableError("ANTHROPIC_API_KEY não configurada.");
  return key;
}
