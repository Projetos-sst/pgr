import {
  parseModelInstructions,
  type ServiceOrderInstructionContext,
  type SuggestedInstruction,
} from "@/shared/domains/safety/ai-service-order-instructions";

import { SstAgent } from "../core/sst-agent";
import {
  SERVICE_ORDER_INSTRUCTIONS,
  buildServiceOrderInstructionPrompt,
  serviceOrderInstructionOutputSchema,
  type ServiceOrderInstructionOutput,
} from "./prompt";

/**
 * **Agente "instruções de segurança da OS" (NR-01 1.4.1).** A partir da função, dos riscos
 * e dos EPIs da atividade, redige as instruções que o trabalhador lê e assina. Complementa
 * `buildSuggestedItems`, que só lista riscos e EPIs: aqui sai o texto acionável.
 */
export class ServiceOrderInstructionAgent extends SstAgent<
  ServiceOrderInstructionContext,
  ServiceOrderInstructionOutput,
  SuggestedInstruction[]
> {
  readonly id = "service-order-instructions";
  readonly name = "Sugestão de instruções de segurança da OS";
  readonly instructions = SERVICE_ORDER_INSTRUCTIONS;
  readonly outputSchema = serviceOrderInstructionOutputSchema;

  /** Até 12 frases curtas, mas imperativas e completas. */
  readonly maxOutputTokens = 2048;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: ServiceOrderInstructionContext): string {
    return buildServiceOrderInstructionPrompt(ctx);
  }

  /**
   * O domínio descarta item inválido sem derrubar o lote e remove repetição interna. O
   * descarte do que a OS **já contém** é do core: depende do banco, e a definição do
   * agente é compartilhada entre execuções.
   */
  parseOutput(raw: ServiceOrderInstructionOutput): SuggestedInstruction[] {
    return parseModelInstructions(raw);
  }
}

export const serviceOrderInstructionAgent = new ServiceOrderInstructionAgent();
