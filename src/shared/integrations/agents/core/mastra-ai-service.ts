import "server-only";

import { Agent } from "@mastra/core/agent";

import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { requireOpenRouterApiKey, resolveModelChain } from "../config";
import type { SstAgent } from "./sst-agent";

/**
 * Executor **único** dos agentes: recebe uma definição (`SstAgent`) e devolve a saída já
 * validada e traduzida para o domínio. Toda a mecânica de provedor mora aqui — retry,
 * fallback de modelo, timeout, saída estruturada e tradução de falha — para que um agente
 * novo seja só uma definição declarativa.
 *
 * Resiliência (em camadas, da mais barata para a mais cara):
 * 1. **Retry** no mesmo modelo, feito pelo Mastra (`maxRetries` por candidato);
 * 2. **Fallback** para o próximo modelo da cadeia quando os retries se esgotam;
 * 3. **Timeout** por agente, cobrindo 1 e 2 juntos;
 * 4. Qualquer falha restante vira `AiUnavailableError` — a UI degrada para o manual.
 *
 * Por que `jsonPromptInjection: "auto"`: os modelos gratuitos da OpenRouter não anunciam
 * suporte nativo a `response_format`, e forçar o caminho nativo devolvia objeto vazio.
 * No modo automático o Mastra injeta o schema no prompt quando o modelo não suporta o
 * nativo — foi o que fez a saída estruturada funcionar de fato no tier gratuito.
 */
export class MastraAiService {
  /**
   * Agentes do Mastra são imutáveis e caros de montar; a definição é estável por
   * processo, então instanciamos uma vez por `id`.
   */
  private readonly agents = new Map<string, Agent>();

  async run<TInput, TRaw, TOutput>(
    definition: SstAgent<TInput, TRaw, TOutput>,
    input: TInput,
  ): Promise<TOutput> {
    // Falha com a nossa mensagem genérica em vez do erro cru do framework.
    requireOpenRouterApiKey();

    try {
      const result = await this.agent(definition).generate(
        definition.buildPrompt(input),
        {
          structuredOutput: {
            schema: definition.outputSchema,
            jsonPromptInjection: "auto",
          },
          modelSettings: { maxOutputTokens: definition.maxOutputTokens },
          abortSignal: AbortSignal.timeout(definition.timeoutMs),
        },
      );

      // Sem objeto = o modelo não produziu o formato pedido, mesmo após retry/fallback.
      if (!result.object) throw new AiUnavailableError();
      // O Mastra já validou contra `outputSchema`; o cast só reata o genérico, que o
      // framework perde ao aceitar o schema por uma interface comum.
      return definition.parseOutput(result.object as TRaw);
    } catch (error) {
      if (error instanceof AiUnavailableError) throw error;
      // O erro do provedor/framework fica no servidor; o cliente recebe só o genérico.
      console.error(`[agents] ${definition.id} falhou:`, error);
      throw new AiUnavailableError();
    }
  }

  private agent(definition: SstAgent<unknown, unknown, unknown>): Agent {
    const cached = this.agents.get(definition.id);
    if (cached) return cached;

    const agent = new Agent({
      id: definition.id,
      name: definition.name,
      instructions: definition.instructions,
      model: resolveModelChain(),
    });
    this.agents.set(definition.id, agent);
    return agent;
  }
}

/** Instância compartilhada — o cache de agentes só rende com um executor por processo. */
export const mastraAiService = new MastraAiService();
