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
import { coordinatorInForceOn } from "@/shared/domains/medicine/pcmso-coordinators";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { z } from "zod";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { loadProposalSources } from "./exam-proposal-core";
import {
  listCompanyGesJobRoles,
  listRiskAbsenceDeclarations,
} from "@/shared/db/repositories/risk-absence-declarations";
import {
  applicableRiskAbsence,
  riskAbsenceMismatch,
} from "@/shared/domains/medicine/risk-absence";

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
  const [sources, coordinators, plans, absenceDeclarations, gesJobRoles] =
    await Promise.all([
      loadProposalSources(ctx, companyId),
      listCoordinatorAssignments(ctx, companyId),
      listExamPlans(ctx, companyId),
      listRiskAbsenceDeclarations(ctx, companyId),
      data.employee.gesId
        ? listCompanyGesJobRoles(ctx, companyId, data.employee.gesId)
        : Promise.resolve([]),
    ]);
  // A declaração casa pelo id da função, ainda vinculada ao GES do funcionário (NOB-112).
  const absenceEmployee = {
    gesId: data.employee.gesId,
    jobRoleId: data.employee.jobRoleId,
    gesJobRoleIds: gesJobRoles.map((r) => r.jobRoleId),
  };
  const absenceMismatch = riskAbsenceMismatch(
    absenceDeclarations,
    sources,
    absenceEmployee,
  );
  const performedAt = data.exam.performedAt;
  // Responsável pelo PCMSO na data HISTÓRICA do exame (conteúdo do ASO), não quem age hoje.
  // Duas designações em vigor nessa data: o sistema não escolhe; a conferência bloqueia.
  const inForce = coordinatorInForceOn(coordinators, performedAt);
  const coordinator = inForce.kind === "in_force" ? inForce.assignment : null;
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
    coordinatorOverlap: inForce.kind === "overlap",
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
    riskAbsence: applicableRiskAbsence(absenceDeclarations, sources, absenceEmployee),
    riskAbsenceUnmatchedJobRoles: absenceMismatch.otherJobRoles,
    riskAbsenceLegacyJobRoles: absenceMismatch.legacyJobRoles,
    riskAbsenceJobRoleUnlinked: absenceMismatch.jobRoleUnlinked,
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

export type AsoCurrentComposition = {
  /**
   * SHA-256 da prévia que o exame geraria agora, montada pela mesma regra de `generateDocument`;
   * `null` quando a conferência tem bloqueio (nenhuma prévia poderia ser gerada hoje).
   */
  contentSha256: string | null;
  /**
   * Apto ou inapto do exame hoje: o registrado, ou a confirmação vigente do examinador para "apto
   * com restrição"; `null` quando ainda não há conclusão apto/inapto. O sistema não conclui nada.
   */
  conclusion: "fit" | "unfit" | null;
};

/**
 * Composição atual do ASO do exame, sem gravar nada. Serve para conferir se a prévia assinada (ou
 * o ASO assinado vigente) ainda corresponde aos dados cadastrados (MED-11).
 */
export async function currentAsoComposition(
  ctx: TenantContext,
  examId: string,
): Promise<AsoCurrentComposition> {
  const facts = await loadFacts(ctx, examId);
  const blocked = asoReadiness(facts).some((item) => item.severity === "blocking");
  const conclusion =
    facts.exam.aptitude === "fit_with_restrictions"
      ? (facts.examinerConclusion?.conclusion ?? null)
      : facts.exam.aptitude;
  return {
    contentSha256: blocked ? null : asoContentHash(composeAso(facts)),
    conclusion,
  };
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
