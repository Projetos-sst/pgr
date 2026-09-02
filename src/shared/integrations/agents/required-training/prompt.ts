import { z } from "zod";

import {
  MAX_TRAINING_SUGGESTIONS,
  type JobRoleTrainingContext,
} from "@/shared/domains/pgr/ai-training-suggestion";
import {
  TRAINING_PERIODICITIES,
  trainingPeriodicityLabel,
} from "@/shared/domains/pgr/trainings";

import { flexibleOptionalText, flexibleText } from "../core/flexible-text";

/**
 * Instruções, schema de saída e montagem da mensagem do agente de **treinamentos
 * obrigatórios** — **puro** (sem `server-only`, sem rede).
 */

/**
 * Schema **tolerante**: valida a forma do envelope, não o conteúdo. A validação de verdade
 * (enum da periodicidade, faixa da carga horária) é do domínio, que descarta item a item.
 */
export const requiredTrainingOutputSchema = z.object({
  trainings: z
    .array(
      z.object({
        name: flexibleText(
          "Nome do treinamento, como é conhecido no mercado (ex.: 'NR-35 — Trabalho em Altura').",
        ),
        referenceNorm: flexibleOptionalText(
          "Norma de referência, só o código (ex.: 'NR-35', 'NR-10').",
        ),
        periodicity: flexibleText(
          `Periodicidade da reciclagem. Um de: ${TRAINING_PERIODICITIES.join(", ")}.`,
        ),
        workloadHours: flexibleText(
          "Carga horária mínima em horas exigida pela norma, apenas o número.",
        ),
        rationale: flexibleOptionalText(
          "Por que esta função precisa deste treinamento, em uma frase.",
        ),
      }),
    )
    .describe(
      `Treinamentos obrigatórios da função, no máximo ${MAX_TRAINING_SUGGESTIONS}, do mais essencial ao menos. Lista vazia é resposta válida quando a função não sustenta nenhum treinamento específico.`,
    ),
});

export type RequiredTrainingOutput = z.infer<typeof requiredTrainingOutputSchema>;

export const REQUIRED_TRAINING_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio das Normas Regulamentadoras (NRs) do MTE e dos requisitos de capacitação de cada uma.",
  "Sua tarefa é dizer quais treinamentos são obrigatórios para UMA função, a partir do cargo e dos riscos aos quais ela está exposta.",
  "",
  "Regras:",
  "1. Proponha apenas treinamento exigido por norma para esta função. Curso genérico de desenvolvimento ou integração institucional não entra.",
  "2. Ancore cada treinamento na NR correspondente e informe a carga horária mínima que a norma exige. Não invente carga horária: se não souber a da norma, não proponha o treinamento.",
  `3. Periodicidade: use o valor da norma — ${TRAINING_PERIODICITIES.map((p) => `${p} (${trainingPeriodicityLabel(p)})`).join(", ")}. 'single' é para o que não tem reciclagem periódica.`,
  "4. O catálogo da organização NÃO limita a sua resposta: ele é vocabulário, não cardápio. Proponha tudo que a norma exige para a função, mesmo que nada disso esteja cadastrado — o sistema cadastra depois o que faltar.",
  "5. Só quando o curso que você vai propor JÁ estiver no catálogo, use exatamente o nome de lá — é assim que o sistema reconhece que é o mesmo curso em vez de duplicá-lo.",
  "6. Não repita treinamento já marcado como obrigatório para esta função.",
  "7. O título do cargo é evidência suficiente para os treinamentos típicos daquela ocupação: 'Eletricista' sustenta NR-10, 'Pedreiro' sustenta NR-18 e NR-35, 'Operador de Empilhadeira' sustenta NR-11. Os riscos listados reforçam, não limitam.",
  "8. Inclua sempre o que vale para praticamente todo trabalhador operacional: NR-06 (uso de EPI) e a capacitação inicial de NR-01. Só omita quando a função claramente não os exigir.",
  "9. Uma função operacional raramente tem menos de três treinamentos obrigatórios. Se sua lista ficou com zero ou um item, você deixou de fora o básico da atividade — revise antes de responder.",
  "10. O que não deve entrar: treinamento de atividade que a ocupação não exerce. Não proponha NR-33 (espaço confinado) ou NR-34 (naval) para quem não trabalha nesses ambientes.",
  "11. Nunca cite nome de pessoa, CPF ou dado médico.",
  "12. Escreva em português do Brasil, em linguagem técnica de SST, objetiva e sem rodeios.",
].join("\n");

/**
 * Monta a mensagem **exclusivamente** a partir do contexto não-PII: título da função, GES
 * a que pertence, riscos e o catálogo da organização. Nunca dados de funcionários.
 *
 * O catálogo entra no prompt de propósito: sem ele o modelo inventa um nome novo para um
 * curso que a organização já cadastrou, e a conciliação por nome falha — o usuário acaba
 * com "NR-35 Altura" e "NR-35 — Trabalho em Altura" como dois cursos distintos.
 */
export function buildRequiredTrainingPrompt(ctx: JobRoleTrainingContext): string {
  const riscos =
    ctx.risks.length > 0
      ? ctx.risks
          .map(
            (r) =>
              `  - [${r.agentType}] ${r.hazard ? `${r.hazard}: ` : ""}${r.description}`,
          )
          .join("\n")
      : "  - nenhum risco cadastrado";

  const catalogo =
    ctx.catalog.length > 0
      ? ctx.catalog.map((c) => `  - ${c.name} (${c.periodicity})`).join("\n")
      : "  - catálogo vazio";

  return [
    "Liste os treinamentos obrigatórios para a função abaixo.",
    "",
    `Função: ${ctx.jobRoleTitle}`,
    ctx.gesNames.length > 0 ? `GES: ${ctx.gesNames.join("; ")}` : null,
    "",
    "Riscos aos quais a função está exposta:",
    riscos,
    "",
    "Catálogo já cadastrado na organização — use o nome exato SÓ se for o mesmo curso que você for propor; ele não limita a sua lista:",
    catalogo,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
