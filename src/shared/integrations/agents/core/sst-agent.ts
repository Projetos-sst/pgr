import type { ZodType } from "zod";

/**
 * Contrato de saída anexado às instruções de **todo** agente.
 *
 * Com `jsonPromptInjection`, o schema JSON vai dentro do prompt — e os modelos pequenos do
 * tier gratuito às vezes o confundem com o pedido: devolvem `{"$schema": …, "properties":
 * …}`, isto é, a definição em vez do dado. Medido no agente de medidas de controle, isso
 * derrubava 4 de 5 execuções, sempre com falha rápida (~3s, resposta curta demais para ser
 * conteúdo).
 *
 * Fica na classe base de propósito: é limitação do provedor, não regra de um agente, e
 * agente novo herda a proteção sem precisar saber que ela existe.
 */
const OUTPUT_CONTRACT = [
  "",
  "Formato da resposta (obrigatório):",
  "- Responda SOMENTE com o objeto JSON preenchido com o conteúdo real que você produziu.",
  '- NUNCA devolva o schema: nada de "$schema", "type", "properties", "items" ou "required".',
  "- Não escreva texto, comentário ou cerca de código fora do JSON.",
].join("\n");

/**
 * Contrato de um agente de IA da plataforma. Um agente é **declarativo**: diz quem é
 * (`instructions`), o que recebe (`buildPrompt`), o formato fixo que devolve
 * (`outputSchema`) e como esse formato vira o tipo do domínio (`parseOutput`). Quem
 * executa é o `MastraAiService` — nenhuma subclasse fala com o provedor.
 *
 * Criar um agente novo = estender esta classe e exportar uma instância. Nada de rede,
 * retry, timeout ou fallback de modelo se repete por agente.
 *
 * @typeParam TInput  Contexto do caso concreto, já sanitizado pelo core (nunca PII).
 * @typeParam TRaw    O que o modelo devolve, validado por `outputSchema`.
 * @typeParam TOutput O tipo consumido pelo domínio.
 */
export abstract class SstAgent<TInput, TRaw, TOutput> {
  /** Identificador estável — aparece no log e nas métricas do Mastra. */
  abstract readonly id: string;

  /** Nome legível do agente. */
  abstract readonly name: string;

  /**
   * Papel, regras e limites do agente — o "system prompt". Fixo: não varia por caso,
   * só por versão do agente. Tudo que muda a cada chamada vai em `buildPrompt`.
   */
  abstract readonly instructions: string;

  /** Formato fixo da resposta. É o que o provedor é obrigado a produzir. */
  abstract readonly outputSchema: ZodType<TRaw>;

  /** Teto de tokens da resposta — dimensione pelo tamanho real da saída do agente. */
  readonly maxOutputTokens: number = 1024;

  /**
   * Teto de tempo da execução, já contando os retries e o fallback de modelo.
   * Estourou → `AiUnavailableError`, e o usuário segue no preenchimento manual.
   */
  readonly timeoutMs: number = 30_000;

  /**
   * Instruções efetivamente enviadas: as do agente mais o contrato de saída comum. É o que
   * o executor consome — sobrescrever `instructions` numa subclasse não remove o contrato.
   */
  get systemPrompt(): string {
    return `${this.instructions}\n${OUTPUT_CONTRACT}`;
  }

  /** Contexto do caso concreto → mensagem enviada ao modelo. */
  abstract buildPrompt(input: TInput): string;

  /**
   * Ponte entre o que o modelo devolve e o que o domínio consome. É aqui que mora a
   * tolerância a variação do modelo (chave em snake_case, item inválido no meio de uma
   * lista) — o schema garante a forma, este método garante o significado.
   */
  abstract parseOutput(raw: TRaw): TOutput;
}
