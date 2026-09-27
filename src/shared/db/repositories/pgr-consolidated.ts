import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  deriveMeasureState,
  deriveRiskPlanCoverage,
  sortConsolidatedRisks,
  type ConsolidatedAssessment,
  type ConsolidatedEpi,
  type ConsolidatedGes,
  type ConsolidatedMeasure,
  type ConsolidatedRisk,
  type ControlLevel,
  type ControlMeasureStatus,
  type PgrConsolidated,
  type RiskAgentType,
  type RiskClassification,
  type AssessmentCriterion,
  type ExposureTime,
  type MeasurementUnit,
  type Nr09Conclusion,
  type ConsolidatedErgonomicEvaluation,
} from "@/shared/domains/pgr/pgr-consolidated";
import { listErgonomicDimensions } from "@/shared/domains/pgr/ergonomics";
import type { EpiNeutralization } from "@/shared/domains/pgr/epi-risk";
import type { PgrRegistrationType } from "@/shared/domains/pgr/pgr";

import { withOrg } from "../with-org";
import {
  getCurrentErgonomicEvaluationsByRiskTx,
  getPsychosocialAggregatesTx,
} from "./ergonomic-evaluations";
import { pgr, pgrGes } from "../schema/pgr";
import { companies } from "../schema/companies";
import { workUnits } from "../schema/work-units";
import { ges } from "../schema/ges";
import { risks, controlMeasures } from "../schema/risks";
import { epiRisk, epiCatalog } from "../schema/epis";
import { documents } from "../schema/documents";

/** Data local do negócio (America/Sao_Paulo) em AAAA-MM-DD, para o estado derivado. */
function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
}

/** Linha crua da avaliação vigente (snake_case — vem de `tx.execute`). */
type CurrentAssessmentRow = {
  risk_id: string;
  criterion: string;
  probability: number;
  severity: number;
  risk_level: number;
  uncertainty_degree: number;
  tolerance_limit: string | null;
  result: string | null;
  assessed_at: string;
  // NR-09 (#39)
  evaluation_method: string | null;
  measured_value: string | null;
  measured_unit: string | null;
  tolerance_limit_value: string | null;
  nr09_conclusion: string | null;
};

/**
 * Visão consolidada read-only do PGR. Composição em **queries em lote** (sem N+1):
 * PGR+empresa+obra → GES vinculados → riscos (`inArray`, detalhe + eSocial S-2240) → avaliação
 * vigente por risco (`DISTINCT ON`, params bind-seguros) → medidas (`inArray`, 5W2H completo + status) →
 * **EPIs por risco** (`epi_risk` ⨝ `epi_catalog`, `inArray`); agrupa/ordena em memória.
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
        companyWebsite: companies.website,
        workUnitName: workUnits.name,
        responsible: pgr.responsible,
        registrationType: pgr.registrationType,
        registrationNumber: pgr.registrationNumber,
        issuedAt: pgr.issuedAt,
        validUntil: pgr.validUntil,
        // Seção 1 do PDF (#47) — identificação completa, tudo já persistido.
        companyNomeFantasia: companies.nomeFantasia,
        companyCnpj: companies.cnpj,
        companyCnae: companies.cnae,
        companyMainActivity: companies.mainActivity,
        companyRiskGrade: companies.riskGrade,
        companyZipCode: companies.zipCode,
        companyStreet: companies.street,
        companyNumber: companies.number,
        companyComplement: companies.complement,
        companyDistrict: companies.district,
        companyCity: companies.city,
        companyState: companies.state,
        workUnitType: workUnits.type,
        workUnitContractNumber: workUnits.contractNumber,
        workUnitManagerName: workUnits.managerName,
        workUnitManagerRole: workUnits.managerRole,
        workUnitProfessionalTitle: workUnits.professionalTitle,
        workUnitProfessionalRegistration: workUnits.professionalRegistration,
        workUnitStartDate: workUnits.startDate,
        workUnitExpectedEndDate: workUnits.expectedEndDate,
        workUnitZipCode: workUnits.zipCode,
        workUnitStreet: workUnits.street,
        workUnitNumber: workUnits.number,
        workUnitComplement: workUnits.complement,
        workUnitDistrict: workUnits.district,
        workUnitCity: workUnits.city,
        workUnitState: workUnits.state,
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

    // ART anexada ao responsável técnico (issue #36) — referenciada no PDF quando existir.
    const [artDocument] = await tx
      .select({ name: documents.name })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.relatedEntityType, "responsible_technician"),
          eq(documents.relatedEntityId, pgrId),
          eq(documents.status, "ready"),
        ),
      )
      .orderBy(sql`${documents.createdAt} desc`)
      .limit(1);

    const pgrHead: PgrConsolidated["pgr"] = {
      id: head.id,
      companyName: head.companyName,
      companyWebsite: head.companyWebsite ?? null,
      artDocumentName: artDocument?.name ?? null,
      workUnitName: head.workUnitName ?? null,
      responsible: head.responsible,
      registrationType: head.registrationType as PgrRegistrationType,
      registrationNumber: head.registrationNumber,
      issuedAt: head.issuedAt,
      validUntil: head.validUntil,
      company: {
        razaoSocial: head.companyName,
        nomeFantasia: head.companyNomeFantasia ?? null,
        cnpj: head.companyCnpj ?? null,
        cnae: head.companyCnae ?? null,
        mainActivity: head.companyMainActivity ?? null,
        riskGrade: head.companyRiskGrade ?? null,
        website: head.companyWebsite ?? null,
        address: {
          zipCode: head.companyZipCode ?? null,
          street: head.companyStreet ?? null,
          number: head.companyNumber ?? null,
          complement: head.companyComplement ?? null,
          district: head.companyDistrict ?? null,
          city: head.companyCity ?? null,
          state: head.companyState ?? null,
        },
      },
      workUnit: head.workUnitName
        ? {
            name: head.workUnitName,
            type: head.workUnitType ?? null,
            contractNumber: head.workUnitContractNumber ?? null,
            managerName: head.workUnitManagerName ?? null,
            managerRole: head.workUnitManagerRole ?? null,
            professionalTitle: head.workUnitProfessionalTitle ?? null,
            professionalRegistration: head.workUnitProfessionalRegistration ?? null,
            startDate: head.workUnitStartDate ?? null,
            expectedEndDate: head.workUnitExpectedEndDate ?? null,
            address: {
              zipCode: head.workUnitZipCode ?? null,
              street: head.workUnitStreet ?? null,
              number: head.workUnitNumber ?? null,
              complement: head.workUnitComplement ?? null,
              district: head.workUnitDistrict ?? null,
              city: head.workUnitCity ?? null,
              state: head.workUnitState ?? null,
            },
          }
        : null,
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

    // 3) Riscos dos GES (um inArray) — detalhe + campos eSocial S-2240.
    const riskRows = await tx
      .select({
        id: risks.id,
        gesId: risks.gesId,
        agentType: risks.agentType,
        description: risks.description,
        hazard: risks.hazard,
        sources: risks.sources,
        propagation: risks.propagation,
        exposureTime: risks.exposureTime,
        possibleInjuries: risks.possibleInjuries,
        noxiousAgentCode: risks.noxiousAgentCode,
        measurementUnit: risks.measurementUnit,
        concentrationIntensity: risks.concentrationIntensity,
      })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), inArray(risks.gesId, gesIds)));
    const riskIds = riskRows.map((r) => r.id);

    // 4) Avaliação vigente por risco (DISTINCT ON, uma query, params bind-seguros).
    const assessmentByRisk = new Map<string, ConsolidatedAssessment>();
    if (riskIds.length > 0) {
      const rows = (await tx.execute(sql`
        select distinct on (risk_id)
          risk_id, criterion, probability, severity, risk_level,
          uncertainty_degree, tolerance_limit, result, assessed_at,
          evaluation_method, measured_value, measured_unit,
          tolerance_limit_value, nr09_conclusion
        from public.risk_assessments
        where org_id = ${orgId}
          and risk_id in (${sql.join(
            riskIds.map((id) => sql`${id}`),
            sql`, `,
          )})
        order by risk_id, assessed_at desc, created_at desc
      `)) as unknown as CurrentAssessmentRow[];
      for (const row of rows) {
        assessmentByRisk.set(row.risk_id, {
          criterion: row.criterion as AssessmentCriterion,
          probability: row.probability,
          severity: row.severity,
          riskLevel: row.risk_level,
          uncertaintyDegree: row.uncertainty_degree,
          toleranceLimit: row.tolerance_limit,
          result: row.result as RiskClassification | null,
          assessedAt: row.assessed_at,
          evaluationMethod: row.evaluation_method,
          measuredValue: row.measured_value,
          measuredUnit: row.measured_unit as MeasurementUnit | null,
          toleranceLimitValue: row.tolerance_limit_value,
          nr09Conclusion: row.nr09_conclusion as Nr09Conclusion | null,
        });
      }
    }

    // 5) Medidas por risco (um inArray) — 5W2H completo + estado derivado.
    const measuresByRisk = new Map<string, ConsolidatedMeasure[]>();
    if (riskIds.length > 0) {
      const today = todaySaoPaulo();
      const measureRows = await tx
        .select({
          id: controlMeasures.id,
          riskId: controlMeasures.riskId,
          controlLevel: controlMeasures.controlLevel,
          applicable: controlMeasures.applicable,
          status: controlMeasures.status,
          justification: controlMeasures.justification,
          monitoring: controlMeasures.monitoring,
          actionWhat: controlMeasures.actionWhat,
          actionWhy: controlMeasures.actionWhy,
          actionHow: controlMeasures.actionHow,
          actionTracking: controlMeasures.actionTracking,
          actionMeasurement: controlMeasures.actionMeasurement,
          actionResponsible: controlMeasures.actionResponsible,
          actionDeadline: controlMeasures.actionDeadline,
          actionCost: controlMeasures.actionCost,
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
          status: m.status as ControlMeasureStatus | null,
          justification: m.justification,
          monitoring: m.monitoring,
          actionWhat: m.actionWhat,
          actionWhy: m.actionWhy,
          actionHow: m.actionHow,
          actionTracking: m.actionTracking,
          actionMeasurement: m.actionMeasurement,
          actionResponsible: m.actionResponsible,
          actionDeadline: m.actionDeadline,
          actionCost: m.actionCost,
          state: deriveMeasureState(
            { applicable: m.applicable, actionDeadline: m.actionDeadline },
            today,
          ),
        });
        measuresByRisk.set(m.riskId, list);
      }
    }

    // 6) EPIs por risco (um inArray) — mesma forma de `listRiskEpis`.
    const episByRisk = new Map<string, ConsolidatedEpi[]>();
    if (riskIds.length > 0) {
      const epiRows = await tx
        .select({
          id: epiRisk.id,
          riskId: epiRisk.riskId,
          catalogId: epiRisk.catalogId,
          name: epiCatalog.name,
          ca: epiCatalog.ca,
          neutralization: epiRisk.neutralization,
          // Especificação técnica do EPI (#48) — mesmo join, nenhuma query extra.
          description: epiCatalog.description,
          caValidUntil: epiCatalog.caValidUntil,
          manufacturer: epiCatalog.manufacturer,
          norm: epiCatalog.norm,
          material: epiCatalog.material,
          size: epiCatalog.size,
          unitOfMeasure: epiCatalog.unitOfMeasure,
          usefulLifeMonths: epiCatalog.usefulLifeMonths,
        })
        .from(epiRisk)
        .innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
        .where(and(eq(epiRisk.orgId, orgId), inArray(epiRisk.riskId, riskIds)))
        .orderBy(asc(epiCatalog.name));
      for (const e of epiRows) {
        const list = episByRisk.get(e.riskId) ?? [];
        list.push({
          id: e.id,
          catalogId: e.catalogId,
          name: e.name,
          ca: e.ca,
          neutralization: e.neutralization as EpiNeutralization,
          description: e.description,
          caValidUntil: e.caValidUntil,
          manufacturer: e.manufacturer,
          norm: e.norm,
          material: e.material,
          size: e.size,
          unitOfMeasure: e.unitOfMeasure,
          usefulLifeMonths: e.usefulLifeMonths,
        });
        episByRisk.set(e.riskId, list);
      }
    }

    // 7) Avaliação ergonômica vigente por risco (#40) + agregado psicossocial das
    //    campanhas vinculadas. Duas queries em lote — nunca uma por risco. As respostas
    //    individuais da campanha NÃO são lidas: só contagem e fatores derivados.
    const ergonomicByRisk = new Map<string, ConsolidatedErgonomicEvaluation>();
    if (riskIds.length > 0) {
      const rows = await getCurrentErgonomicEvaluationsByRiskTx(tx, orgId, riskIds);
      const campaignIds = [...rows.values()]
        .map((r) => r.psychosocialCampaignId)
        .filter((id): id is string => Boolean(id));
      const aggregates = await getPsychosocialAggregatesTx(tx, orgId, campaignIds);
      for (const [riskId, row] of rows) {
        ergonomicByRisk.set(riskId, {
          id: row.id,
          assessedAt: row.assessedAt,
          responsible: row.responsible,
          method: row.method,
          notes: row.notes,
          dimensions: listErgonomicDimensions(row),
          psychosocial: row.psychosocialCampaignId
            ? (aggregates.get(row.psychosocialCampaignId) ?? null)
            : null,
        });
      }
    }

    // Composição em memória: riscos por GES, ordenados por nível.
    const risksByGes = new Map<string, ConsolidatedRisk[]>();
    for (const r of riskRows) {
      const assessment = assessmentByRisk.get(r.id) ?? null;
      const measures = measuresByRisk.get(r.id) ?? [];
      const result = assessment ? assessment.result : null;
      const list = risksByGes.get(r.gesId) ?? [];
      list.push({
        id: r.id,
        agentType: r.agentType as RiskAgentType,
        description: r.description,
        hazard: r.hazard,
        sources: r.sources,
        propagation: r.propagation,
        exposureTime: r.exposureTime as ExposureTime | null,
        possibleInjuries: r.possibleInjuries,
        noxiousAgentCode: r.noxiousAgentCode,
        measurementUnit: r.measurementUnit as MeasurementUnit | null,
        concentrationIntensity: r.concentrationIntensity,
        riskLevel: assessment ? assessment.riskLevel : null,
        result,
        assessment,
        measures,
        // #42: todo risco entra no plano do PGR com cobertura derivada — nada é criado.
        planCoverage: deriveRiskPlanCoverage({ result, measures }),
        epis: episByRisk.get(r.id) ?? [],
        ergonomic: ergonomicByRisk.get(r.id) ?? null,
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
