import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { getCompanyById } from "@/shared/db/repositories/companies";
import { listExamPlans } from "@/shared/db/repositories/medical-exam-plans";
import { listEmployees } from "@/shared/db/repositories/employees";
import { listMedicos } from "@/shared/db/repositories/medicos";
import { listCoordinatorAssignments } from "@/shared/db/repositories/pcmso-coordinators";
import { buildExamProposal } from "@/shared/domains/medicine/exam-proposal";
import { criteriaCoverage } from "@/shared/domains/medicine/interpretation-criteria";
import { checkPcmsoReadiness } from "@/shared/domains/medicine/pcmso-readiness";
import { coordinatorInForceOn } from "@/shared/domains/medicine/pcmso-coordinators";
import { canUseMedicalRisk } from "@/shared/domains/medicine/risk-sources";
import { todayInSaoPaulo } from "@/shared/dates";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { PAGE_SIZE_MAX } from "@/shared/pagination";

import { getLatestAnalyticalReport } from "@/shared/db/repositories/pcmso-analytical-reports";

import { loadProposalSources } from "./exam-proposal-core";
import {
  approvedPlannedProcedures,
  currentCriteria,
} from "./interpretation-criteria-core";

/**
 * Conferência do PCMSO (NOB-148). As leituras sensíveis passam pelos repositórios de cada
 * domínio: inventário e coordenador conferem empresa, tenant e módulo Medicina (RLS).
 * O coordenador conferido é o **vigente hoje** (America/Sao_Paulo), data em que a conferência e a
 * prévia são produzidas (NOB-109): designação agendada para o futuro não conta; encerramento
 * agendado não tira quem segue vigente até lá.
 */
export async function getPcmsoReadiness(ctx: TenantContext, companyId: string) {
  return getPcmsoReadinessOn(ctx, companyId, todayInSaoPaulo());
}

/**
 * Conferência numa data de referência calculada no servidor (nunca vinda do cliente): a geração
 * da prévia usa a mesma data na conferência e na composição.
 */
export async function getPcmsoReadinessOn(
  ctx: TenantContext,
  companyId: string,
  referenceDay: string,
) {
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const company = await getCompanyById(ctx.tenantId, id);
  if (!company) throw new NotFoundError();
  const sources = await loadProposalSources(ctx, id);
  const [history, active, onLeave, medicos, plans, planned, criteria, report] =
    await Promise.all([
      listCoordinatorAssignments(ctx, id),
      listEmployees(ctx.tenantId, { companyId: id, status: "active", pageSize: 1 }),
      listEmployees(ctx.tenantId, { companyId: id, status: "on_leave", pageSize: 1 }),
      listMedicos(ctx.tenantId, { status: "active", pageSize: PAGE_SIZE_MAX }),
      listExamPlans(ctx, id),
      approvedPlannedProcedures(ctx, id),
      currentCriteria(ctx, id),
      getLatestAnalyticalReport(ctx, id),
    ]);
  const approved = plans.find((plan) => plan.status === "approved") ?? null;
  const draft = plans.find((plan) => plan.status === "draft") ?? null;
  const inForce = coordinatorInForceOn(history, referenceDay);
  const current = inForce.kind === "in_force" ? inForce.assignment : null;
  const usableRisks = sources
    .filter((source) => !source.superseded)
    .flatMap((source) =>
      source.risks
        .filter((risk) => canUseMedicalRisk(risk.status, source.freshness))
        .map((risk) => ({
          description: risk.content.description,
          possibleInjuries: risk.content.possibleInjuries ?? null,
        })),
    );
  return checkPcmsoReadiness({
    companyId: id,
    company: {
      razaoSocial: company.razaoSocial,
      cnpj: company.cnpj,
      cnae: company.cnae,
      mainActivity: company.mainActivity,
      riskGrade: company.riskGrade,
    },
    activeEmployees: active.total + onLeave.total,
    coordinator: current
      ? {
          medicoName: current.medicoName,
          rqe: current.medicoRqe,
          rqeExceptionReason: current.rqeExceptionReason,
        }
      : null,
    coordinatorOverlap: inForce.kind === "overlap",
    proposal: buildExamProposal(sources),
    usableRisks,
    activePhysicians: medicos.rows.filter((m) => m.profession === "physician").length,
    examPlan: {
      approved: approved
        ? { version: approved.version, sourceIds: planSourceIds(approved.basedOn) }
        : null,
      draftVersion: draft?.version ?? null,
    },
    analyticalReport: report
      ? {
          version: report.version,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
        }
      : null,
    interpretationCriteriaMissing: planned
      ? criteriaCoverage(planned.items, criteria).missing
      : null,
  });
}

/** Ids das fontes de risco gravados na proveniência do plano (`based_on.sources`). */
export function planSourceIds(basedOn: unknown): string[] {
  const sources = (basedOn as { sources?: { id?: unknown }[] } | null)?.sources;
  return Array.isArray(sources)
    ? sources.map((s) => s.id).filter((id): id is string => typeof id === "string")
    : [];
}
