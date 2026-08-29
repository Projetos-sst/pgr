import { z } from "zod";

/**
 * Origem polimórfica de um Plano de Ação (Fase 06 / US6). `origin_type` é **TEXT validado na
 * aplicação** (não pgEnum) — V1 aceita `risk`, `incident` e `control_measure` (issue #51);
 * `inspection`/`non_conformity` plugam depois sem migration. `origin_id` **não** tem FK física:
 * existência/tenant são validados na aplicação (origem inválida/inexistente/cross-tenant →
 * `FK_NOT_FOUND`/422).
 */

export const ACTION_PLAN_ORIGIN_TYPES = ["risk", "incident", "control_measure"] as const;

export const actionPlanOriginTypeSchema = z.enum(ACTION_PLAN_ORIGIN_TYPES);
export type ActionPlanOriginType = z.infer<typeof actionPlanOriginTypeSchema>;

export const ORIGIN_TYPE_LABELS: Record<ActionPlanOriginType, string> = {
  risk: "Risco",
  incident: "Incidente",
  control_measure: "Medida de Controle",
};

export function originTypeLabel(value: string): string {
  return ORIGIN_TYPE_LABELS[value as ActionPlanOriginType] ?? value;
}

/**
 * Representação **segura** da origem para exibição (get/list). Não expõe PII nem dado médico do
 * incidente. `removed = true` quando a origem foi apagada depois (o plano permanece como histórico
 * — FR-036). `title` é uma descrição resumida permitida (nunca conteúdo sensível).
 */
export type OriginSnapshot = {
  type: ActionPlanOriginType;
  id: string;
  title: string | null;
  removed: boolean;
};
