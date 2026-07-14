import "server-only";

import { and, eq, isNull, lt, ne, sql } from "drizzle-orm";

import { todayInSaoPaulo } from "@/shared/dates";

import {
  companies,
  controlMeasures,
  employees,
  epiDeliveries,
  epiDeliveryItems,
  epiStock,
  ges,
  pgr,
  risks,
  workUnits,
} from "../schema";
import { withOrg } from "../with-org";
import { getTrainingDueSummary } from "./training-compliance";
import {
  fillActionPlansByLevel,
  fillRisksByAgentType,
  type DashboardSummary,
} from "@/shared/domains/platform/dashboard";

const countExpr = sql<number>`count(*)::int`;

/**
 * Read-model do dashboard: agregações escopadas ao tenant (todas as queries
 * filtram `org_id` explicitamente, além do backstop RLS via `withOrg`). Sem
 * tabelas novas. Módulos ainda não modelados (ordens de serviço, incidentes-evento,
 * monitoramento psicossocial) não têm dado — "acidentes"/"psicossocial" aparecem
 * apenas como grupos de `risks.agent_type`.
 */
export async function getDashboardSummary(orgId: string): Promise<DashboardSummary> {
  const today = todayInSaoPaulo();

  const summary = await withOrg(orgId, async (tx) => {
    const [[companyRow], [employeeRow], [workUnitRow], [gesRow], [riskRow], [pgrRow]] =
      await Promise.all([
        tx.select({ n: countExpr }).from(companies).where(eq(companies.orgId, orgId)),
        tx.select({ n: countExpr }).from(employees).where(eq(employees.orgId, orgId)),
        tx.select({ n: countExpr }).from(workUnits).where(eq(workUnits.orgId, orgId)),
        tx.select({ n: countExpr }).from(ges).where(eq(ges.orgId, orgId)),
        tx.select({ n: countExpr }).from(risks).where(eq(risks.orgId, orgId)),
        tx.select({ n: countExpr }).from(pgr).where(eq(pgr.orgId, orgId)),
      ]);

    const risksByAgent = await tx
      .select({ key: risks.agentType, count: countExpr })
      .from(risks)
      .where(eq(risks.orgId, orgId))
      .groupBy(risks.agentType);

    const plansByLevel = await tx
      .select({ key: controlMeasures.controlLevel, count: countExpr })
      .from(controlMeasures)
      .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.applicable, true)))
      .groupBy(controlMeasures.controlLevel);

    const [{ n: pgrsExpired }] = await tx
      .select({ n: countExpr })
      .from(pgr)
      .where(and(eq(pgr.orgId, orgId), lt(pgr.validUntil, today)));

    const [{ n: controlsOverdue }] = await tx
      .select({ n: countExpr })
      .from(controlMeasures)
      .where(
        and(
          eq(controlMeasures.orgId, orgId),
          eq(controlMeasures.applicable, true),
          lt(controlMeasures.actionDeadline, today),
        ),
      );

    const [{ n: episLowStock }] = await tx
      .select({ n: countExpr })
      .from(epiStock)
      .where(and(eq(epiStock.orgId, orgId), lt(epiStock.balance, epiStock.minQuantity)));

    const [{ n: episPendingReturn }] = await tx
      .select({ n: countExpr })
      .from(epiDeliveryItems)
      .innerJoin(
        epiDeliveries,
        and(
          eq(epiDeliveries.id, epiDeliveryItems.deliveryId),
          eq(epiDeliveries.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(epiDeliveryItems.orgId, orgId),
          isNull(epiDeliveryItems.returnedAt),
          ne(epiDeliveries.signatureStatus, "pending"),
        ),
      );

    return {
      kpis: {
        companies: companyRow?.n ?? 0,
        employees: employeeRow?.n ?? 0,
        workUnits: workUnitRow?.n ?? 0,
        ges: gesRow?.n ?? 0,
        risks: riskRow?.n ?? 0,
        pgrs: pgrRow?.n ?? 0,
      },
      risksByAgentType: fillRisksByAgentType(risksByAgent),
      actionPlansByLevel: fillActionPlansByLevel(plansByLevel),
      pending: { pgrsExpired, controlsOverdue, episLowStock, episPendingReturn },
    };
  });

  // Vencimentos de treinamento reutilizam a lógica de janela já existente.
  const training = await getTrainingDueSummary(orgId);

  return {
    ...summary,
    pending: {
      ...summary.pending,
      trainingsExpired: training.expired,
      trainingsDueSoon: training.dueSoon,
    },
  };
}
