import "server-only";

import { and, eq, gt, gte, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { todayInSaoPaulo } from "@/shared/dates";

import {
  accidents,
  companies,
  controlMeasures,
  employees,
  epiCatalog,
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
  type DashboardKpis,
  type DashboardSummary,
} from "@/shared/domains/platform/dashboard";
import type { OnboardingCounts } from "@/shared/domains/platform/onboarding";
import { EPI_CA_DUE_WINDOW_DAYS } from "@/shared/domains/pgr/epi-relation";

const countExpr = sql<number>`count(*)::int`;

// Janela de "a vencer" do CA de EPI. A constante passou a viver no domínio
// (`domains/pgr/epi-relation.ts`, #48) para que o KPI do dashboard e a relação de
// EPIs do PGR não usem prazos diferentes para a mesma pergunta.

/** "Hoje + N dias" (`YYYY-MM-DD`) — mesmo cálculo do `addDays` privado de `domains/pgr/trainings.ts`. */
function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = PgTransaction<any, any, any>;

async function computeCoreKpis(tx: Tx, orgId: string): Promise<DashboardKpis> {
  const [[companyRow], [employeeRow], [workUnitRow], [gesRow], [riskRow], [pgrRow]] =
    await Promise.all([
      tx.select({ n: countExpr }).from(companies).where(eq(companies.orgId, orgId)),
      tx.select({ n: countExpr }).from(employees).where(eq(employees.orgId, orgId)),
      tx.select({ n: countExpr }).from(workUnits).where(eq(workUnits.orgId, orgId)),
      tx.select({ n: countExpr }).from(ges).where(eq(ges.orgId, orgId)),
      tx.select({ n: countExpr }).from(risks).where(eq(risks.orgId, orgId)),
      tx.select({ n: countExpr }).from(pgr).where(eq(pgr.orgId, orgId)),
    ]);

  return {
    companies: companyRow?.n ?? 0,
    employees: employeeRow?.n ?? 0,
    workUnits: workUnitRow?.n ?? 0,
    ges: gesRow?.n ?? 0,
    risks: riskRow?.n ?? 0,
    pgrs: pgrRow?.n ?? 0,
  };
}

/**
 * Contagens usadas pela Trilha de Sucesso (`/getting-started` + badge de
 * onboarding no header): os 6 KPIs núcleo + os 2 módulos "bônus" — só
 * `count(*)` simples, sem as agregações pesadas do dashboard completo, para
 * não pagar esse custo em toda navegação autenticada.
 */
export async function getOnboardingCounts(orgId: string): Promise<OnboardingCounts> {
  return withOrg(orgId, async (tx) => {
    const t = tx as Tx;
    const [core, [epiCatalogRow], [serviceOrderRow]] = await Promise.all([
      computeCoreKpis(t, orgId),
      t.select({ n: countExpr }).from(epiCatalog).where(eq(epiCatalog.orgId, orgId)),
      t
        .select({ n: countExpr })
        .from(serviceOrders)
        .where(eq(serviceOrders.orgId, orgId)),
    ]);

    return {
      ...core,
      epiCatalogItems: epiCatalogRow?.n ?? 0,
      serviceOrders: serviceOrderRow?.n ?? 0,
    };
  });
}

/**
 * Read-model do dashboard: agregações escopadas ao tenant (todas as queries
 * filtram `org_id` explicitamente, além do backstop RLS via `withOrg`).
 */
export async function getDashboardSummary(orgId: string): Promise<DashboardSummary> {
  const today = todayInSaoPaulo();

  const summary = await withOrg(orgId, async (tx) => {
    const kpis = await computeCoreKpis(tx as Tx, orgId);

    const employeeStatusRows = await tx
      .select({ status: employees.status, count: countExpr })
      .from(employees)
      .where(eq(employees.orgId, orgId))
      .groupBy(employees.status);
    const activeEmployees =
      employeeStatusRows.find((r) => r.status === "active")?.count ?? 0;

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
    const [{ n: pgrsDueSoon }] = await tx
      .select({ n: countExpr })
      .from(pgr)
      .where(
        and(
          eq(pgr.orgId, orgId),
          gte(pgr.validUntil, today),
          lte(pgr.validUntil, addDaysIso(today, 30)),
        ),
      );

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

    // CA de EPI vencido/a vencer (#34, espelha getTrainingDueSummary): só itens
    // com saldo em uso (`balance > 0`, mesma lógica de `episLowStock`); sem
    // validade cadastrada (`caValidUntil` nulo) não entra em nenhuma contagem.
    const [{ n: episCaExpired }] = await tx
      .select({ n: countExpr })
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(
        and(
          eq(epiStock.orgId, orgId),
          gt(epiStock.balance, 0),
          lt(epiCatalog.caValidUntil, today),
        ),
      );

    const [{ n: episCaDueSoon }] = await tx
      .select({ n: countExpr })
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(
        and(
          eq(epiStock.orgId, orgId),
          gt(epiStock.balance, 0),
          gte(epiCatalog.caValidUntil, today),
          lte(epiCatalog.caValidUntil, addDaysIso(today, EPI_CA_DUE_WINDOW_DAYS)),
        ),
      );

    return {
      kpis,
      employeesBreakdown: {
        active: activeEmployees,
        inactive: Math.max(kpis.employees - activeEmployees, 0),
      },
      risksByAgentType: fillRisksByAgentType(risksByAgent),
      actionPlansByLevel: fillActionPlansByLevel(plansByLevel),
      pending: {
        pgrsExpired,
        pgrsDueSoon,
        controlsOverdue,
        episLowStock,
        episPendingReturn,
        episCaExpired,
        episCaDueSoon,
      },
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
