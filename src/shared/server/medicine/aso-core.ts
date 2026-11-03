import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/aso";
import { getExamPlan, listExamPlans } from "@/shared/db/repositories/medical-exam-plans";
import { listCoordinatorAssignments } from "@/shared/db/repositories/pcmso-coordinators";
import {
  asoChecklist,
  asoContentHash,
  asoReadiness,
  composeAso,
  employeeRisks,
  examProcedureInputSchema,
  type AsoFacts,
} from "@/shared/domains/medicine/aso";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { z } from "zod";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { loadProposalSources } from "./exam-proposal-core";
import { listRiskAbsenceDeclarations } from "@/shared/db/repositories/risk-absence-declarations";
import { applicableRiskAbsence } from "@/shared/domains/medicine/risk-absence";

const examUuid = (id: string) => requiredUuid("Exame inválido.").parse(id);
const norm = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

/**
 * Reúne os fatos do ASO: dados do exame (empresa onde foi realizado, MED-07), riscos validados
 * do GES/função, coordenador vigente na data do exame e exames mantidos no plano aprovado.
 */
async function loadFacts(ctx: TenantContext, examId: string): Promise<AsoFacts> {
  const data = await repo.loadAsoExamFacts(ctx, examUuid(examId));
  // Sem origem comprovada, a referência é a empresa atual do funcionário; a conferência bloqueia.
  const companyId = data.exam.companyId ?? data.employee.companyId;
  const [sources, coordinators, plans, absenceDeclarations] = await Promise.all([
    loadProposalSources(ctx, companyId),
    listCoordinatorAssignments(ctx, companyId),
    listExamPlans(ctx, companyId),
    listRiskAbsenceDeclarations(ctx, companyId),
  ]);
  const performedAt = data.exam.performedAt;
  const coordinator = coordinators.find(
    (row) =>
      row.startsOn <= performedAt && (row.endsOn === null || row.endsOn >= performedAt),
  );
  const approved = plans.find((plan) => plan.status === "approved");
  const plan = approved ? await getExamPlan(ctx, approved.id) : null;
  const examiner = data.examiner;

  return {
    exam: {
      examType: data.exam.examType,
      performedAt,
      aptitude: data.exam.aptitude,
      companyId: data.exam.companyId,
    },
    examinerConclusion: data.examinerConclusion
      ? {
          conclusion: data.examinerConclusion.conclusion,
          confirmedAt: new Date(data.examinerConclusion.confirmedAt).toISOString(),
        }
      : null,
    employee: data.employee,
    company: data.company,
    examiner: examiner
      ? {
          name: examiner.name,
          profession: examiner.profession,
          registration: formatProfessionalRegistration(examiner),
          registrationUf: examiner.registrationUf,
        }
      : null,
    coordinator: coordinator
      ? {
          name: coordinator.medicoName,
          registration: formatProfessionalRegistration({
            crm: coordinator.medicoCrm,
            profession: "physician",
            registrationUf: coordinator.medicoRegistrationUf,
          }),
          rqe: coordinator.medicoRqe,
        }
      : null,
    risks: employeeRisks(sources, data.employee),
    // Só declaração explícita na versão vigente da fonte (NOB-156, DT-12); nunca presumida.
    riskAbsence: applicableRiskAbsence(absenceDeclarations, sources, data.employee),
    procedures: data.procedures.map((p) => ({
      procedureCode: p.procedureCode,
      otherDescription: p.otherDescription,
      performedAt: p.performedAt,
    })),
    plannedProcedures: plan
      ? plan.items
          .filter(
            (item) =>
              item.decision === "kept" &&
              norm(item.exposureGroup) === norm(data.employee.gesName) &&
              (!norm(item.jobRole) || norm(item.jobRole) === norm(data.employee.jobRole)),
          )
          .map((item) => ({
            procedureCode: item.procedureCode,
            otherDescription: item.otherDescription,
          }))
      : null,
  };
}

/** Conferência do ASO (7.5.19.1 a–g) para o exame, sem gravar nada. */
export async function getAsoReadiness(ctx: TenantContext, examId: string) {
  const items = asoReadiness(await loadFacts(ctx, examId));
  return { items, checklist: asoChecklist(items) };
}

export function listProcedures(ctx: TenantContext, examId: string) {
  return repo.listExamProcedures(ctx, examUuid(examId));
}

export function addProcedure(ctx: TenantContext, examId: string, input: unknown) {
  return repo.addExamProcedure(
    ctx,
    examUuid(examId),
    examProcedureInputSchema.parse(input),
  );
}

export async function removeProcedure(
  ctx: TenantContext,
  examId: string,
  procedureId: string,
) {
  const removed = await repo.removeExamProcedure(
    ctx,
    examUuid(examId),
    requiredUuid("Procedimento inválido.").parse(procedureId),
  );
  if (!removed) throw new NotFoundError();
}

export function listDocuments(ctx: TenantContext, examId: string) {
  return repo.listAsoDocuments(ctx, examUuid(examId));
}

export function getDocument(ctx: TenantContext, id: string) {
  return repo.getAsoDocument(ctx, requiredUuid("Documento inválido.").parse(id));
}

/**
 * Gera e arquiva uma nova versão **prévia** do ASO, só sem bloqueios na conferência. Não conclui
 * aptidão, não assina e não emite: a prévia repete a conclusão registrada do examinador.
 */
export async function generateDocument(ctx: TenantContext, examId: string) {
  const facts = await loadFacts(ctx, examId);
  const blocking = asoReadiness(facts).filter((item) => item.severity === "blocking");
  if (blocking.length)
    throw new ValidationError(
      `O ASO tem pendências que impedem a prévia: ${blocking.map((b) => b.message).join(" ")}`,
    );
  const content = composeAso(facts);
  return repo.insertAsoDocument(ctx, examUuid(examId), {
    content,
    contentSha256: asoContentHash(content),
  });
}

export const examOriginConfirmationSchema = z
  .object({
    justification: z
      .string()
      .trim()
      .min(10, "Explique em pelo menos 10 caracteres como a origem foi comprovada.")
      .max(1000, "Máximo de 1.000 caracteres."),
  })
  .strict();

/** O responsável confirma, com justificativa, que um exame antigo foi feito na empresa atual. */
export async function confirmCompanyOrigin(
  ctx: TenantContext,
  examId: string,
  input: unknown,
) {
  const { justification } = examOriginConfirmationSchema.parse(input);
  return repo.confirmExamCompanyOrigin(ctx, examUuid(examId), justification);
}

export const examinerConclusionSchema = z
  .object({
    conclusion: z.enum(["fit", "unfit"], { error: "Informe apto ou inapto." }),
  })
  .strict();

export function listExaminerConclusions(ctx: TenantContext, examId: string) {
  return repo.listExaminerConclusions(ctx, examUuid(examId));
}

/** O examinador, pela conta vinculada, confirma apto ou inapto para "apto com restrição". */
export async function confirmExaminerConclusion(
  ctx: TenantContext,
  examId: string,
  input: unknown,
) {
  const { conclusion } = examinerConclusionSchema.parse(input);
  return repo.confirmExaminerConclusion(ctx, examUuid(examId), conclusion);
}
