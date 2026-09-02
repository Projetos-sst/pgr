import {
  parseModelTrainings,
  type JobRoleTrainingContext,
  type SuggestedTraining,
} from "@/shared/domains/pgr/ai-training-suggestion";

import { SstAgent } from "../core/sst-agent";
import {
  REQUIRED_TRAINING_INSTRUCTIONS,
  buildRequiredTrainingPrompt,
  requiredTrainingOutputSchema,
  type RequiredTrainingOutput,
} from "./prompt";

/**
 * **Agente "treinamentos obrigatórios" (NRs do MTE).** A partir do título da função e dos
 * riscos a que ela se expõe, diz quais capacitações a norma exige, com NR de referência,
 * carga horária e periodicidade. O usuário revisa e aceita antes de virar vínculo em
 * `job_role_required_trainings`.
 */
export class RequiredTrainingAgent extends SstAgent<
  JobRoleTrainingContext,
  RequiredTrainingOutput,
  SuggestedTraining[]
> {
  readonly id = "required-training";
  readonly name = "Sugestão de treinamentos obrigatórios";
  readonly instructions = REQUIRED_TRAINING_INSTRUCTIONS;
  readonly outputSchema = requiredTrainingOutputSchema;

  /** Até 10 itens, mas cada um é curto (nome, norma, carga, periodicidade, motivo). */
  readonly maxOutputTokens = 2048;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: JobRoleTrainingContext): string {
    return buildRequiredTrainingPrompt(ctx);
  }

  /**
   * O domínio descarta item inválido sem derrubar o lote (carga horária absurda denuncia
   * alucinação) e remove nome repetido. A conciliação com o catálogo é do core: depende do
   * banco, não da resposta do modelo.
   */
  parseOutput(raw: RequiredTrainingOutput): SuggestedTraining[] {
    return parseModelTrainings(raw);
  }
}

export const requiredTrainingAgent = new RequiredTrainingAgent();
