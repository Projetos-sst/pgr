import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  deriveMeasureState,
  sortConsolidatedRisks,
  type ConsolidatedGes,
  type ConsolidatedMeasure,
  type ConsolidatedRisk,
  type ControlLevel,
  type PgrConsolidated,
  type RiskAgentType,
  type RiskClassification,
} from "@/shared/domains/pgr/pgr-consolidated";
import type { PgrRegistrationType } from "@/shared/domains/pgr/pgr";

import { withOrg } from "../with-org";
import { pgr, pgrGes } from "../schema/pgr";
import { companies } from "../schema/companies";
import { workUnits } from "../schema/work-units";
import { ges } from "../schema/ges";
import { risks, controlMeasures } from "../schema/risks";

/** Data local do negócio (America/Sao_Paulo) em AAAA-MM-DD, para o estado derivado. */
function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
}

type CurrentAssessmentRow = {
  risk_id: string;
  risk_level: number;
  result: string | null;
};

/**
 * Visão consolidada read-only do PGR. Composição em **≈5 queries em lote** (sem N+1):
 * PGR+empresa+obra → GES vinculados → riscos (`inArray`) → avaliação vigente por risco
 * (`DISTINCT ON`, params bind-seguros) → medidas (`inArray`); agrupa/ordena em memória.
 * `null` se o PGR não existe no tenant (→ 404 na Action). Não persiste nada; não gera PDF.
 */
export async function getPgrConsolidated(
  orgId: string,
  pgrId: string,
): Promise<PgrConsolidated | null> {
  return withOrg(orgId, async (tx) => {
    // 1) PGR + empresa + obra
    const [head] = await tx
      .select({
        id: pgr.id,
        companyName: companies.razaoSocial,
        workUnitName: workUnits.name,
        responsible: pgr.responsible,
        registrationType: pgr.registrationType,
        registrationNumber: pgr.registrationNumber,
        issuedAt: pgr.issuedAt,
        validUntil: pgr.validUntil,
      })
      .from(pgr)
      .innerJoin(
        companies,
        and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)),
      )
      .leftJoin(
        workUnits,
        and(eq(workUnits.id, pgr.workUnitId), eq(workUnits.orgId, orgId)),
      )
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
      .limit(1);
    if (!head) return null;

    const pgrHead: PgrConsolidated["pgr"] = {
      id: head.id,
      companyName: head.companyName,
      workUnitName: head.workUnitName ?? null,
      responsible: head.responsible,
      registrationType: head.registrationType as PgrRegistrationType,
      registrationNumber: head.registrationNumber,
      issuedAt: head.issuedAt,
      validUntil: head.validUntil,
    };

    // 2) GES vinculados
    const gesRows = await tx
      .select({ id: ges.id, name: ges.name })
      .from(pgrGes)
      .innerJoin(ges, and(eq(ges.id, pgrGes.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId)))
      .orderBy(asc(ges.name));
    if (gesRows.length === 0) return { pgr: pgrHead, ges: [] };
    const gesIds = gesRows.map((g) => g.id);

    // 3) Riscos dos GES (um inArray)
    const riskRows = await tx
      .select({
        id: risks.id,
        gesId: risks.gesId,
        agentType: risks.agentType,
        description: risks.description,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), inArray(risks.gesId, gesIds)));
    const riskIds = riskRows.map((r) => r.id);

    // 4) Avaliação vigente por risco (DISTINCT ON, uma query, params bind-seguros)
    const currentByRisk = new Map<string, { riskLevel: number; result: string | null }>();
    if (riskIds.length > 0) {
      const rows = (await tx.execute(sql`
        select distinct on (risk_id) risk_id, risk_level, result
        from public.risk_assessments
        where org_id = ${orgId}
          and risk_id in (${sql.join(
            riskIds.map((id) => sql`${id}`),
            sql`, `,
          )})
        order by risk_id, assessed_at desc, created_at desc
      `)) as unknown as CurrentAssessmentRow[];
      for (const row of rows) {
        currentByRisk.set(row.risk_id, {
          riskLevel: row.risk_level,
          result: row.result,
        });
      }
    }

    // 5) Medidas por risco (um inArray)
    const measuresByRisk = new Map<string, ConsolidatedMeasure[]>();
    if (riskIds.length > 0) {
      const today = todaySaoPaulo();
      const measureRows = await tx
        .select({
          id: controlMeasures.id,
          riskId: controlMeasures.riskId,
          controlLevel: controlMeasures.controlLevel,
          applicable: controlMeasures.applicable,
          actionResponsible: controlMeasures.actionResponsible,
          actionDeadline: controlMeasures.actionDeadline,
        })
        .from(controlMeasures)
        .where(
          and(eq(controlMeasures.orgId, orgId), inArray(controlMeasures.riskId, riskIds)),
        );
      for (const m of measureRows) {
        const list = measuresByRisk.get(m.riskId) ?? [];
        list.push({
          id: m.id,
          controlLevel: m.controlLevel as ControlLevel,
          applicable: m.applicable,
          actionResponsible: m.actionResponsible,
          actionDeadline: m.actionDeadline,
          state: deriveMeasureState(
            { applicable: m.applicable, actionDeadline: m.actionDeadline },
            today,
          ),
        });
        measuresByRisk.set(m.riskId, list);
      }
    }

    // Composição em memória: riscos por GES, ordenados por nível.
    const risksByGes = new Map<string, ConsolidatedRisk[]>();
    for (const r of riskRows) {
      const current = currentByRisk.get(r.id) ?? null;
      const list = risksByGes.get(r.gesId) ?? [];
      list.push({
        id: r.id,
        agentType: r.agentType as RiskAgentType,
        description: r.description,
        riskLevel: current ? current.riskLevel : null,
        result: current ? (current.result as RiskClassification | null) : null,
        measures: measuresByRisk.get(r.id) ?? [],
      });
      risksByGes.set(r.gesId, list);
    }

    const consolidatedGes: ConsolidatedGes[] = gesRows.map((g) => ({
      id: g.id,
      name: g.name,
      risks: sortConsolidatedRisks(risksByGes.get(g.id) ?? []),
    }));

    return { pgr: pgrHead, ges: consolidatedGes };
  });
}
