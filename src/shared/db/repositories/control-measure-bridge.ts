import "server-only";

import { and, eq } from "drizzle-orm";

import { isActionPlanTerminal } from "@/shared/domains/safety/action-plan";
import { controlLevelLabel } from "@/shared/domains/pgr/risks";

import { actionPlans, ges, risks, type ControlMeasure } from "../schema";
import { type TenantTransaction } from "../with-org";

/**
 * Ponte automática control_measures → action_plans (issue #51). Uma `control_measure` marcada
 * `applicable: true` com 5W2H mínimo preenchido deve refletir no módulo de Plano de Ação; sem
 * isso, o 5W2H digitado pelo usuário ficava preso em `control_measures`. Origem polimórfica
 * `control_measure` (`action-plan-origin.ts`) — mesmo mecanismo já usado por `risk`/`incident`.
 *
 * **Sempre chamado DENTRO da transação já aberta** por `createControlMeasure`/
 * `updateControlMeasure` (mesmo padrão de `advanceIncidentOnFirstPlanTx` em `accidents.ts`) —
 * nunca abre uma transação própria.
 */
export type ControlMeasureBridgeInput = Pick<
  ControlMeasure,
  | "id"
  | "riskId"
  | "controlLevel"
  | "applicable"
  | "justification"
  | "actionWhat"
  | "actionHow"
  | "actionResponsible"
  | "actionDeadline"
>;

const ORIGIN_TYPE = "control_measure" as const;

/** Busca o plano bridged (se existir) por `(org_id, origin_type='control_measure', origin_id)`. */
async function findBridgedPlan(tx: TenantTransaction, orgId: string, measureId: string) {
  const [row] = await tx
    .select({ id: actionPlans.id, status: actionPlans.status })
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.orgId, orgId),
        eq(actionPlans.originType, ORIGIN_TYPE),
        eq(actionPlans.originId, measureId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function bridgeControlMeasureToActionPlanTx(
  tx: TenantTransaction,
  orgId: string,
  measure: ControlMeasureBridgeInput,
): Promise<void> {
  const existing = await findBridgedPlan(tx, orgId, measure.id);

  if (!measure.applicable) {
    // Medida deixou de ser aplicável: cancela o plano ativo correspondente (se houver).
    // Plano já terminal (concluído/cancelado) não é reaberto/tocado.
    if (existing && !isActionPlanTerminal(existing.status)) {
      await tx
        .update(actionPlans)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, existing.id)));
    }
    return;
  }

  // `applicable: true` mas 5W2H mínimo (o quê/como) ainda não preenchido — a validação atual
  // só exige isso condicionalmente (`controlMeasureInputSchema`), então pode chegar vazio aqui.
  // Não gera/atualiza o plano: os campos obrigatórios de `action_plans` não teriam conteúdo
  // válido, e não inventamos texto genérico para `what`/`how`.
  if (!measure.actionWhat || !measure.actionHow) return;

  // Plano já terminal não é reaberto silenciosamente pela edição da medida.
  if (existing && isActionPlanTerminal(existing.status)) return;

  const [riskRow] = await tx
    .select({ gesName: ges.name })
    .from(risks)
    .innerJoin(ges, eq(ges.id, risks.gesId))
    .where(and(eq(risks.orgId, orgId), eq(risks.id, measure.riskId)))
    .limit(1);
  const gesName = riskRow?.gesName ?? "Ambiente não informado";

  const fields = {
    what: measure.actionWhat,
    how: measure.actionHow,
    who: measure.actionResponsible || "Responsável não definido",
    when: measure.actionDeadline ?? null,
    why:
      measure.justification ||
      `Medida de controle nível ${controlLevelLabel(measure.controlLevel)}`,
    where: gesName,
  };

  if (existing) {
    await tx
      .update(actionPlans)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, existing.id)));
  } else {
    await tx.insert(actionPlans).values({
      orgId,
      originType: ORIGIN_TYPE,
      originId: measure.id,
      status: "planned",
      ...fields,
    });
  }
}
