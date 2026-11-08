import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { getCompanyById } from "@/shared/db/repositories/companies";
import { listEmployees } from "@/shared/db/repositories/employees";
import { getExamPlan, listExamPlans } from "@/shared/db/repositories/medical-exam-plans";
import { getMedicoById, listMedicos } from "@/shared/db/repositories/medicos";
import { listCoordinatorAssignments } from "@/shared/db/repositories/pcmso-coordinators";
import * as repo from "@/shared/db/repositories/pcmso-documents";
import {
  composePcmso,
  pcmsoContentHash,
  pcmsoGenerationSchema,
} from "@/shared/domains/medicine/pcmso-composition";
import { coordinatorInForceOn } from "@/shared/domains/medicine/pcmso-coordinators";
import {
  canUseMedicalRisk,
  riskOriginLabel,
} from "@/shared/domains/medicine/risk-sources";
import { todayInSaoPaulo } from "@/shared/dates";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { PAGE_SIZE_MAX } from "@/shared/pagination";

import { loadProposalSources } from "./exam-proposal-core";
import { getLatestAnalyticalReport } from "@/shared/db/repositories/pcmso-analytical-reports";

import { currentCriteria } from "./interpretation-criteria-core";
import { getPcmsoReadinessOn } from "./pcmso-readiness-core";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);

export function listDocuments(ctx: TenantContext, companyId: string) {
  return repo.listPcmsoDocuments(ctx, companyUuid(companyId));
}

export function getDocument(ctx: TenantContext, id: string) {
  return repo.getPcmsoDocument(ctx, requiredUuid("Documento inválido.").parse(id));
}

/**
 * Gera e arquiva uma nova versão **prévia** do PCMSO. Só com a conferência (NOB-148) sem
 * bloqueios — inclui plano de exames aprovado e atual. Etapas inexistentes no sistema entram no
 * documento como seções pendentes. Não assina nem emite. O coordenador do documento é o vigente
 * na data da geração (America/Sao_Paulo; NOB-109), a mesma data usada na conferência. Prévias já
 * arquivadas são imutáveis e não são recompostas.
 */
export async function generateDocument(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  const id = companyUuid(companyId);
  const { cycleStart } = pcmsoGenerationSchema.parse(input);
  const today = todayInSaoPaulo();
  const readiness = await getPcmsoReadinessOn(ctx, id, today);
  const blocking = readiness.items.filter((item) => item.severity === "blocking");
  if (blocking.length)
    throw new ValidationError(
      `O PCMSO tem pendências que impedem a prévia: ${blocking.map((b) => b.message).join(" ")}`,
    );

  const company = await getCompanyById(ctx.tenantId, id);
  if (!company) throw new NotFoundError();
  const [sources, history, plans, active, onLeave, medicos, criteria, report] =
    await Promise.all([
      loadProposalSources(ctx, id),
      listCoordinatorAssignments(ctx, id),
      listExamPlans(ctx, id),
      listEmployees(ctx.tenantId, { companyId: id, status: "active", pageSize: 1 }),
      listEmployees(ctx.tenantId, { companyId: id, status: "on_leave", pageSize: 1 }),
      listMedicos(ctx.tenantId, { status: "active", pageSize: PAGE_SIZE_MAX }),
      currentCriteria(ctx, id),
      getLatestAnalyticalReport(ctx, id),
    ]);
  const inForce = coordinatorInForceOn(history, today);
  const coordinator = inForce.kind === "in_force" ? inForce.assignment : null;
  const approved = plans.find((plan) => plan.status === "approved");
  // A conferência sem bloqueio garante ambos; a checagem protege contra corrida (inclusive
  // sobreposição de designações, que nunca escolhe uma delas).
  if (!coordinator || !approved)
    throw new ValidationError("Coordenador e plano de exames aprovado são obrigatórios.");
  const plan = await getExamPlan(ctx, approved.id);
  const approver = plan.approvedByMedicoId
    ? await getMedicoById(ctx.tenantId, plan.approvedByMedicoId)
    : null;
  const live = sources.filter((source) => !source.superseded);

  const content = composePcmso({
    cycleStart,
    company: {
      razaoSocial: company.razaoSocial,
      cnpj: company.cnpj ?? "",
      cnae: company.cnae ?? "",
      mainActivity: company.mainActivity ?? "",
      riskGrade: company.riskGrade ?? 0,
      activeEmployees: active.total + onLeave.total,
    },
    coordinator: {
      name: coordinator.medicoName,
      crm: coordinator.medicoCrm,
      registrationUf: coordinator.medicoRegistrationUf,
      rqe: coordinator.medicoRqe,
      rqeExceptionReason: coordinator.rqeExceptionReason,
      startsOn: coordinator.startsOn,
    },
    riskSources: live.map((source) => {
      const used = source.risks.filter((risk) =>
        canUseMedicalRisk(risk.status, source.freshness),
      );
      const lastValidatedOn =
        used
          .map((risk) => risk.reviewedAt ?? "")
          .sort()
          .at(-1)
          ?.slice(0, 10) || null;
      return {
        id: source.id,
        kind: source.kind,
        origin:
          source.kind === "external"
            ? used.length
              ? riskOriginLabel("external")
              : "PGR externo sem risco validado"
            : riskOriginLabel("internal"),
        title: source.title,
        version: source.version,
        reference: source.reference,
        documentDate: source.documentDate ?? null,
        preparedBy: source.preparedBy ?? null,
        validatedRisks: used.length,
        lastValidatedOn,
      };
    }),
    risks: live.flatMap((source) =>
      source.risks
        .filter((risk) => canUseMedicalRisk(risk.status, source.freshness))
        .map((risk) => ({
          exposureGroup: risk.content.exposureGroup,
          jobRole: risk.content.jobRole?.trim() ?? "",
          description: risk.content.description,
          agentType: risk.content.agentType,
          possibleInjuries: risk.content.possibleInjuries?.trim() || null,
        })),
    ),
    plan: {
      id: plan.id,
      version: plan.version,
      approvedAt: new Date(plan.approvedAt!).toISOString(),
      approvedByName: approver?.name ?? "",
      items: plan.items.map((item) => ({
        exposureGroup: item.exposureGroup,
        jobRole: item.jobRole,
        procedureCode: item.procedureCode,
        otherDescription: item.otherDescription,
        decision: item.decision,
        periodicity: item.periodicity,
        origin: item.origin,
      })),
    },
    examiners: medicos.rows
      .filter((m) => m.profession === "physician")
      .map((m) => ({ name: m.name, registration: formatProfessionalRegistration(m) })),
    interpretationCriteria: criteria,
    analyticalReport: report
      ? {
          id: report.id,
          version: report.version,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          contentSha256: report.contentSha256,
        }
      : null,
    pendingSections: readiness.items.filter((item) => item.severity === "not_available"),
  });

  return repo.insertPcmsoDocument(ctx, id, {
    examPlanId: plan.id,
    cycleStart: content.planningCycle.start,
    cycleEnd: content.planningCycle.end,
    content,
    contentSha256: pcmsoContentHash(content),
  });
}
