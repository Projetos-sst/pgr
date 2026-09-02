/**
 * Contrato de **tool call** da API Chat Completions (OpenRouter/OpenAI) — módulo **puro**
 * (sem `server-only`): é o que cada agente usa para ler a saída estruturada do modelo,
 * e o que os testes unitários exercitam sem tocar a rede.
 */

/** Definição de ferramenta enviada ao modelo (function calling). */
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** Tool call devolvido pelo modelo. `arguments` vem como **string JSON**. */
export type ToolCall = {
  type?: string;
  function?: { name?: string; arguments?: string };
};

/**
 * Localiza o tool call de `name` e devolve seus argumentos já desserializados.
 * Ausente ou JSON inválido → `null` (cada agente decide o fallback).
 */
export function readToolCallArguments(calls: ToolCall[], name: string): unknown {
  for (const call of calls) {
    if (call.function?.name !== name) continue;
    try {
      return JSON.parse(call.function?.arguments ?? "");
    } catch {
      return null;
    }
  }
  return null;
}
