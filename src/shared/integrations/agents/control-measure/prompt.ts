import { z } from "zod";

import {
  MAX_MEASURE_SUGGESTIONS,
  controlLevelLabel,
  riskClassificationLabel,
  type RiskControlContext,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";
import { riskClassificationGuidance } from "@/shared/domains/pgr/methodology";
import type { ControlLevel } from "@/shared/domains/pgr/risks";

import { flexibleOptionalText, flexibleText } from "../core/flexible-text";
import { line } from "../core/prompt-line";

/**
 * Instruções, schema de saída e montagem da mensagem do agente de **medidas de controle** —
 * **puro** (sem `server-only`, sem rede). É o que os testes unitários exercitam para
 * garantir que só o contexto permitido entra no prompt.
 */

const LEVELS: ControlLevel[] = [
  "elimination",
  "substitution",
  "collective_protection",
  "administrative",
  "ppe",
];

/**
 * Schema **tolerante**: valida a forma do envelope, não o conteúdo. A validação de verdade
 * (enum do nível, campos obrigatórios) é do domínio, que descarta item a item — uma medida
 * malformada não pode derrubar as outras três. `flexibleText` porque 'como' costuma vir em
 * lista de passos, e um `string[]` reprovaria aqui, jogando fora a resposta inteira.
 */
export const controlMeasureOutputSchema = z.object({
  measures: z
    .array(
      z.object({
        controlLevel: flexibleText(
          `Nível da hierarquia de controle (NR-01). Um de: ${LEVELS.join(", ")}.`,
        ),
        actionWhat: flexibleText("O que será feito — a medida, no infinitivo."),
        actionWhy: flexibleOptionalText(
          "Por que a ação é necessária — o motivo técnico ligado a este risco.",
        ),
        actionHow: flexibleText("Como implementar — passos concretos e verificáveis."),
        monitoring: flexibleOptionalText(
          "Como verificar se a medida segue eficaz ao longo do tempo.",
        ),
        justification: flexibleOptionalText(
          "Por que este nível de controle cabe neste risco.",
        ),
      }),
    )
    .describe(
      `Medidas de controle, no máximo ${MAX_MEASURE_SUGGESTIONS} — no MÁXIMO UMA por nível. Lista vazia é resposta válida quando o contexto não sustenta nenhuma medida.`,
    ),
});

export type ControlMeasureOutput = z.infer<typeof controlMeasureOutputSchema>;

/**
 * Papel e regras. Numeradas porque modelos pequenos (os gratuitos que usamos) seguem
 * instrução enumerada melhor do que parágrafo corrido.
 */
export const CONTROL_MEASURE_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01 e do Gerenciamento de Riscos Ocupacionais (GRO).",
  "Sua tarefa é propor medidas de controle para UM risco ocupacional já identificado.",
  "",
  "Regras:",
  `1. Respeite a hierarquia de controle da NR-01, nesta ordem de preferência: ${LEVELS.map((l) => `${l} (${controlLevelLabel(l)})`).join(" > ")}.`,
  "2. Comece SEMPRE pelo nível mais eficaz que for tecnicamente viável para este risco. EPI é o último recurso, nunca a primeira proposta.",
  "3. No MÁXIMO uma medida por nível, e só proponha o nível que fizer sentido: três medidas boas valem mais que cinco para preencher a lista.",
  "4. Não repita nível que já esteja cadastrado no risco — ele será rejeitado.",
  "5. 'Como' deve ser acionável: passos concretos e verificáveis, não intenção genérica.",
  "6. Em 'monitoramento', diga como verificar que a medida continua eficaz (inspeção, medição, checklist, periodicidade).",
  "7. Não defina responsável nem prazo: são compromisso de pessoa, e quem preenche é o usuário.",
  "8. Baseie-se APENAS no contexto fornecido. Não invente equipamento, norma, medição ou valor que não esteja no texto.",
  "9. Nunca cite nome de pessoa, CPF ou dado médico.",
  "10. Escreva em português do Brasil, em linguagem técnica de SST, objetiva e sem rodeios.",
  "11. Em 'actionWhy', diga por que a ação é necessária, ligando-a ao perigo e às fontes deste risco. Sem base no contexto, deixe vazio.",
].join("\n");

/**
 * Monta a mensagem **exclusivamente** a partir do contexto não-PII do risco: o risco, o
 * ambiente do GES e a classificação vigente. Nunca dados de funcionários.
 *
 * A orientação normativa da classificação (`riskClassificationGuidance`) entra no prompt
 * porque é a regra que a própria plataforma aplica — o agente deve propor medida coerente
 * com o que o sistema já exige naquele nível de risco.
 */
export function buildControlMeasurePrompt(ctx: RiskControlContext): string {
  const classificacao = ctx.classification
    ? `${riskClassificationLabel(ctx.classification)}${ctx.riskLevel != null ? ` (nível ${ctx.riskLevel})` : ""} — ${riskClassificationGuidance(ctx.classification)}`
    : null;

  const jaCadastrados =
    ctx.existingLevels.length > 0
      ? ctx.existingLevels.map((l) => `${l} (${controlLevelLabel(l)})`).join("; ")
      : null;

  return [
    "Proponha as medidas de controle para o risco ocupacional abaixo.",
    "",
    line("Grupo do agente", ctx.agentType),
    line("Descrição do risco", ctx.description),
    line("Perigo", ctx.hazard),
    line("Fontes geradoras", ctx.sources),
    line("Possíveis lesões (genérico)", ctx.possibleInjuries),
    line("GES", ctx.gesName),
    line("Descrição do processo", ctx.processDescription),
    line("Ambiente", ctx.environment),
    ctx.roleTitles.length > 0 ? `- Funções expostas: ${ctx.roleTitles.join("; ")}` : null,
    line("Classificação vigente", classificacao),
    line("Níveis JÁ cadastrados (não repita)", jaCadastrados),
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
