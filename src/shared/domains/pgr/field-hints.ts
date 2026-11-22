/**
 * Dicas de preenchimento (estáticas) para os campos críticos dos formulários de
 * GES — orientam o usuário a escrever conteúdo de qualidade e aderente
 * à NR-01. Constantes puras (sem `server-only`): consumidas por componentes de UI.
 * Boas dicas aqui também melhoram o contexto que alimenta a sugestão por IA.
 */

export const GES_FIELD_HINTS = {
  processDescription:
    "Descreva as etapas do processo produtivo do GES: o que é feito, com quais " +
    "máquinas/insumos e em que sequência. Quanto mais concreto, melhor a análise de riscos.",
  environment:
    "Caracterize o ambiente físico: tipo de construção, pé-direito, piso, cobertura, " +
    "iluminação e ventilação. Cite fontes de calor, ruído, poeira ou agentes químicos presentes.",
  functions:
    "Liste as funções expostas e o número de trabalhadores por função. As atividades de " +
    "cada função guiam a identificação dos riscos (físicos, químicos, ergonômicos etc.).",
} as const;

export type GesFieldHintKey = keyof typeof GES_FIELD_HINTS;
