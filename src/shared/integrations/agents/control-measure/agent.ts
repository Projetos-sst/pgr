import {
  parseModelMeasures,
  type RiskControlContext,
  type SuggestedControlMeasure,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";

import { SstAgent } from "../core/sst-agent";
import {
  CONTROL_MEASURE_INSTRUCTIONS,
  buildControlMeasurePrompt,
  controlMeasureOutputSchema,
  type ControlMeasureOutput,
} from "./prompt";

/**
 * **Agente "medidas de controle" (NR-01/GRO).** Recebe o contexto **não-PII** de um risco
 * já identificado e propõe como controlá-lo, respeitando a hierarquia da NR-01. O usuário
 * revisa e aceita antes de virar linha em `control_measures`.
 *
 * É o passo seguinte do agente de riscos: lá a IA diz *o que ameaça*, aqui diz *como
 * controlar*.
 */
export class ControlMeasureAgent extends SstAgent<
  RiskControlContext,
  ControlMeasureOutput,
  SuggestedControlMeasure[]
> {
  readonly id = "control-measure";
  readonly name = "Sugestão de medidas de controle";
  readonly instructions = CONTROL_MEASURE_INSTRUCTIONS;
  readonly outputSchema = controlMeasureOutputSchema;

  /** No máximo 4 medidas, mas 'como' e 'monitoramento' são textos longos por natureza. */
  readonly maxOutputTokens = 2048;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: RiskControlContext): string {
    return buildControlMeasurePrompt(ctx);
  }

  /**
   * O domínio descarta item inválido sem derrubar o lote, remove nível repetido e ordena
   * pela hierarquia da NR-01. O descarte dos níveis **já cadastrados** no risco fica no
   * core: depende do estado do banco, e a definição do agente é compartilhada entre
   * execuções — guardar contexto de uma chamada aqui vazaria para a seguinte.
   */
  parseOutput(raw: ControlMeasureOutput): SuggestedControlMeasure[] {
    return parseModelMeasures(raw);
  }
}

export const controlMeasureAgent = new ControlMeasureAgent();
