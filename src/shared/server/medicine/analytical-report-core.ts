import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/pcmso-analytical-reports";
import {
  analyticalReportHash,
  analyticalReportInputSchema,
  analyticalReportPeriodSchema,
  composeAnalyticalReport,
  countCats,
  countClinicalExams,
  countProcedures,
  periodIssues,
  simplificationEligibility,
  type IndicatorSource,
  type PreviousReportRef,
} from "@/shared/domains/medicine/analytical-report";
import { addDays, addMonths } from "@/shared/domains/medicine/nr7-schedule-rules";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { todayInSaoPaulo } from "@/shared/dates";
import { ValidationError } from "@/shared/errors/validation-error";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);

const toPrevious = (row: repo.AnalyticalReportSummary & { content: unknown }) =>
  ({
    id: row.id,
    version: row.version,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    content: row.content as IndicatorSource,
  }) satisfies PreviousReportRef;

/** Período sugerido: começa no dia seguinte ao último relatório e vai até 12 meses, sem passar de hoje. */
function suggestedPeriod(
  previous: { periodEnd: string } | null,
  today = todayInSaoPaulo(),
) {
  if (!previous) return null;
  const start = addDays(previous.periodEnd, 1);
  const yearEnd = addDays(addMonths(start, 12), -1);
  return { periodStart: start, periodEnd: yearEnd < today ? yearEnd : today };
}

function consolidate(data: repo.AnalyticalReportData) {
  return {
    clinical: {
      ...countClinicalExams(data.clinicalRows),
      unverifiedOrigin: data.unverifiedOrigin,
    },
    complementary: countProcedures(data.procedureRows),
    cats: countCats(data.catRows, data.catsWithoutIssueDate),
  };
}

export function listReports(ctx: TenantContext, companyId: string) {
  return repo.listAnalyticalReports(ctx, companyUuid(companyId));
}

export function getReport(ctx: TenantContext, id: string) {
  return repo.getAnalyticalReport(ctx, requiredUuid("Relatório inválido.").parse(id));
}

/**
 * Contexto para elaborar o relatório (equipe e coordenador): período sugerido, relatório anterior,
 * enquadramento no 7.6.6 e, com período informado, os números consolidados e os problemas do
 * período. Não grava nada.
 */
export async function getReportContext(
  ctx: TenantContext,
  companyId: string,
  period?: unknown,
) {
  const id = companyUuid(companyId);
  const latest = await repo.getLatestAnalyticalReport(ctx, id);
  const previous = latest
    ? {
        id: latest.id,
        version: latest.version,
        periodStart: latest.periodStart,
        periodEnd: latest.periodEnd,
      }
    : null;
  const suggestion = suggestedPeriod(latest);
  const chosen = period ? analyticalReportPeriodSchema.parse(period) : suggestion;
  if (!chosen)
    return {
      previous,
      suggestedPeriod: null,
      period: null,
      issues: [],
      eligibility: null,
      totals: null,
    };
  const data = await repo.loadAnalyticalReportData(ctx, id, chosen);
  const totals = consolidate(data);
  return {
    previous,
    suggestedPeriod: suggestion,
    period: chosen,
    issues: periodIssues(chosen, latest),
    eligibility: simplificationEligibility(data.company.riskGrade, data.employees),
    totals: {
      clinicalExams: totals.clinical.total,
      unverifiedOrigin: totals.clinical.unverifiedOrigin,
      complementaryExams: totals.complementary.total,
      cats: totals.cats.total,
    },
  };
}

/**
 * Elaboração pelo médico coordenador (7.6.2): só a conta vinculada à designação em vigor hoje.
 * Período contíguo ao último relatório; simplificação só se enquadrada (7.6.6); com relatório
 * anterior, a discussão das variações é obrigatória (texto do médico). Arquiva uma prévia imutável.
 */
export async function generateReport(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  const id = companyUuid(companyId);
  const values = analyticalReportInputSchema.parse(input);
  const coordinator = await repo.getActorCoordinator(ctx, id);
  const latest = await repo.getLatestAnalyticalReport(ctx, id);
  const issues = periodIssues(values, latest);
  if (issues.length) throw new ValidationError(issues.map((i) => i.message).join(" "));
  const data = await repo.loadAnalyticalReportData(ctx, id, values);
  const eligibility = simplificationEligibility(data.company.riskGrade, data.employees);
  if (values.simplified && !eligibility.eligible)
    throw new ValidationError(
      `O relatório simplificado (só alíneas a e b) não se aplica: ${eligibility.basis}`,
    );
  if (latest && !values.simplified && !values.variationDiscussion)
    throw new ValidationError(
      "Há relatório anterior: a discussão sobre as variações dos resultados é obrigatória e deve ser escrita pelo médico coordenador (NR-7 7.6.2 f).",
    );
  const content = composeAnalyticalReport({
    period: { periodStart: values.periodStart, periodEnd: values.periodEnd },
    company: data.company,
    employees: data.employees,
    author: {
      name: coordinator.name,
      registration: formatProfessionalRegistration(coordinator),
    },
    simplified: values.simplified,
    ...consolidate(data),
    previous: latest ? toPrevious(latest) : null,
    variationDiscussion: values.variationDiscussion ?? null,
    insufficiencyNote: values.insufficiencyNote ?? null,
  });
  return repo.insertAnalyticalReport(ctx, id, {
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    previousReportId: latest?.id ?? null,
    content,
    contentSha256: analyticalReportHash(content),
  });
}
