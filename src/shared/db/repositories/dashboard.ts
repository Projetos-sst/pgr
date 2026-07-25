import "server-only";

import { and, eq, isNull, lt, ne, sql } from "drizzle-orm";

import { todayInSaoPaulo } from "@/shared/dates";

import {
  accidents,
  companies,
  controlMeasures,
  employees,
  epiDeliveries,
  epiDeliveryItems,
  epiStock,
  ges,
  pgr,
  risks,
  serviceOrders,
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
 * filtram `org_id` explicitamente, além do backstop RLS via `withOrg`).
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

    const soRows = await tx
      .select({ status: serviceOrders.status, count: countExpr })
      .from(serviceOrders)
      .where(eq(serviceOrders.orgId, orgId))
      .groupBy(serviceOrders.status);

    const accidentRows = await tx
      .select({ status: accidents.status, count: countExpr })
      .from(accidents)
      .where(eq(accidents.orgId, orgId))
      .groupBy(accidents.status);

    const soMap = new Map(soRows.map((r) => [r.status, r.count]));
    const signedSO = soMap.get("completed") ?? 0;
    const pendingSO = (soMap.get("open") ?? 0) + (soMap.get("in_progress") ?? 0);
    const refusedSO = soMap.get("cancelled") ?? 0;
    const totalSO = signedSO + pendingSO + refusedSO;

    const accMap = new Map(accidentRows.map((r) => [r.status, r.count]));
    const openAcc = accMap.get("registered") ?? 0;
    const analysisAcc =
      (accMap.get("awaiting_planning") ?? 0) + (accMap.get("awaiting_completion") ?? 0);
    const resolvedAcc = accMap.get("completed") ?? 0;
    const archivedAcc = accMap.get("cancelled") ?? 0;
    const totalAcc = openAcc + analysisAcc + resolvedAcc + archivedAcc;

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
      serviceOrdersSummary: {
        signed: signedSO,
        pending: pendingSO,
        refused: refusedSO,
        total: totalSO,
      },
      accidentsSummary: {
        open: openAcc,
        inAnalysis: analysisAcc,
        resolved: resolvedAcc,
        archived: archivedAcc,
        total: totalAcc,
      },
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
