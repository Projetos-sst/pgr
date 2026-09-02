import "server-only";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { getAiBaseUrl, getAiModel, requireOpenRouterApiKey } from "./config";
import type { ToolCall, ToolDefinition } from "./tool-call";

/**
 * Transporte **único** dos agentes: uma chamada ao endpoint Chat Completions da OpenRouter
 * (compatível com OpenAI) forçando saída estruturada por tool call. Sem SDK — `fetch` basta
 * e evita mais uma dependência. É o único ponto de rede da camada de IA; nos testes de
 * integração os agentes são mockados por cima dele.
 */

/**
 * Teto de tempo (ms) default para a chamada ao provedor; estourou → `AI_UNAVAILABLE`
 * (degradação). Cada agente ajusta conforme o tamanho da resposta que pede: medido contra
 * a OpenRouter, um plano 5W2H volta em ~5–9s, enquanto um inventário de 12 riscos chega a
 * ~20s. Um teto único derrubaria o agente de riscos justamente quando ele acerta mais.
 */
const DEFAULT_TIMEOUT_MS = 20_000;

export type AgentRequest = {
  /** Instrução de papel/regras do agente. */
  system: string;
  /** Contexto já sanitizado do caso concreto. */
  user: string;
  /** Ferramenta que o modelo é obrigado a chamar (structured output). */
  tool: ToolDefinition;
  /** Teto de tokens da resposta — dimensionado por agente. */
  maxTokens: number;
  /** Teto de tempo da chamada; omitido → `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number;
};

/**
 * Executa o request e devolve os `tool_calls` da resposta. Qualquer falha (chave ausente,
 * HTTP não-2xx, timeout, corpo inesperado) vira `AiUnavailableError` — nunca propaga detalhe
 * do provedor para as camadas acima.
 */
export async function runToolCall(request: AgentRequest): Promise<ToolCall[]> {
  try {
    const response = await fetch(`${getAiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${requireOpenRouterApiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: getAiModel(),
        max_tokens: request.maxTokens,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        tools: [request.tool],
        tool_choice: {
          type: "function",
          function: { name: request.tool.function.name },
        },
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) throw new AiUnavailableError();

    const payload = (await response.json()) as {
      choices?: { message?: { tool_calls?: ToolCall[] } }[];
    };
    const calls = payload?.choices?.[0]?.message?.tool_calls;
    return Array.isArray(calls) ? calls : [];
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError();
  }
}
