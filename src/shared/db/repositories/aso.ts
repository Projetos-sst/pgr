import "server-only";

import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { ExamProcedureValues } from "@/shared/domains/medicine/aso";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  asoDocuments as docs,
  asoExaminerConclusions as conclusions,
  type AsoDocument,
  type AsoExaminerConclusion,
} from "../schema/aso-documents";
import { companies } from "../schema/companies";
import { employees } from "../schema/employees";
import { ges } from "../schema/ges";
import {
  healthExamProcedures as procedures,
  healthExams,
  type HealthExamProcedure,
} from "../schema/health-exams";
import { jobRoles } from "../schema/job-roles";
import { medicos, type Medico } from "../schema/medicos";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";

export type AsoDocumentSummary = Omit<AsoDocument, "content">;

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

/**
 * Exame do tenant com Medicina ativa na empresa onde foi realizado. A RLS de `health_exams` já
 * esconde exames de funcionários de empresas sem Medicina → NOT_FOUND. Exame com origem não
 * comprovada (`companyId` nulo) só tem a checagem da RLS, pela empresa atual do funcionário.
 */
async function findExam(
  tx: TenantTransaction,
  orgId: string,
  examId: string,
  { lock = false } = {},
) {
  // Só as colunas do ASO: observações clínicas e caminho do atestado nunca são lidos aqui.
  const [exam] = await tx
    .select({
      id: healthExams.id,
      employeeId: healthExams.employeeId,
      companyId: healthExams.companyId,
      doctorId: healthExams.doctorId,
      examType: healthExams.examType,
      performedAt: healthExams.performedAt,
      aptitude: healthExams.aptitude,
      companyOrigin: healthExams.companyOrigin,
    })
    .from(healthExams)
    .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, examId)))
    .limit(1)
    .for(lock ? "update" : "share");
  if (!exam) throw new NotFoundError();
  if (exam.companyId) await assertCompanyModuleTx(tx, orgId, exam.companyId, "medicine");
  return exam;
}

/** Exame com empresa de origem comprovada; sem ela, nada do ASO é gravado (MED-07). */
function originCompany(exam: { companyId: string | null }): string {
  if (!exam.companyId)
    throw new ValidationError(
      "A empresa onde o exame foi realizado não está comprovada. Confirme a origem antes de usar o exame no ASO.",
    );
  return exam.companyId;
}

export type AsoExamFacts = {
  exam: Awaited<ReturnType<typeof findExam>>;
  employee: {
    fullName: string;
    cpf: string;
    companyId: string;
    gesId: string | null;
    gesName: string | null;
    jobRole: string | null;
  };
  company: { razaoSocial: string; cnpj: string | null };
  examiner: Medico | null;
  procedures: HealthExamProcedure[];
  /** Confirmação vigente: a mais recente do examinador atual sobre o registro atual do exame. */
  examinerConclusion: AsoExaminerConclusion | null;
};

/** Dados cadastrados do exame para o ASO, numa transação. Nunca lê `notes` para fora daqui. */
export async function loadAsoExamFacts(
  ctx: TenantContext,
  examId: string,
): Promise<AsoExamFacts> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    const [employee] = await tx
      .select({
        fullName: employees.fullName,
        cpf: employees.cpf,
        companyId: employees.companyId,
        gesId: employees.gesId,
        gesName: ges.name,
        jobRole: jobRoles.title,
      })
      .from(employees)
      .leftJoin(ges, and(eq(ges.id, employees.gesId), eq(ges.orgId, employees.orgId)))
      .leftJoin(
        jobRoles,
        and(eq(jobRoles.id, employees.jobRoleId), eq(jobRoles.orgId, employees.orgId)),
      )
      .where(and(eq(employees.orgId, ctx.tenantId), eq(employees.id, exam.employeeId)))
      .limit(1);
    if (!employee) throw new NotFoundError();
    const [company] = await tx
      .select({ razaoSocial: companies.razaoSocial, cnpj: companies.cnpj })
      .from(companies)
      .where(
        and(
          eq(companies.orgId, ctx.tenantId),
          eq(companies.id, exam.companyId ?? employee.companyId),
        ),
      )
      .limit(1);
    if (!company) throw new NotFoundError();
    const [examiner] = exam.doctorId
      ? await tx
          .select()
          .from(medicos)
          .where(and(eq(medicos.orgId, ctx.tenantId), eq(medicos.id, exam.doctorId)))
          .limit(1)
      : [];
    const rows = await tx
      .select()
      .from(procedures)
      .where(
        and(eq(procedures.orgId, ctx.tenantId), eq(procedures.healthExamId, exam.id)),
      )
      .orderBy(asc(procedures.performedAt), asc(procedures.procedureCode));
    const [conclusion] = exam.doctorId
      ? await tx
          .select()
          .from(conclusions)
          .where(
            and(
              eq(conclusions.orgId, ctx.tenantId),
              eq(conclusions.healthExamId, exam.id),
              eq(conclusions.examinerMedicoId, exam.doctorId),
              eq(conclusions.recordedAptitude, exam.aptitude),
            ),
          )
          .orderBy(desc(conclusions.confirmedAt))
          .limit(1)
      : [];
    return {
      exam,
      employee,
      company,
      examiner: examiner ?? null,
      procedures: rows,
      examinerConclusion: conclusion ?? null,
    };
  });
}

// ── Procedimentos realizados ─────────────────────────────────────────────────

export async function listExamProcedures(
  ctx: TenantContext,
  examId: string,
): Promise<HealthExamProcedure[]> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    return tx
      .select()
      .from(procedures)
      .where(
        and(eq(procedures.orgId, ctx.tenantId), eq(procedures.healthExamId, exam.id)),
      )
      .orderBy(asc(procedures.performedAt), asc(procedures.procedureCode));
  });
}

/** Registra um exame complementar realizado; a empresa vem do exame, nunca do cliente. */
export async function addExamProcedure(
  ctx: TenantContext,
  examId: string,
  input: ExamProcedureValues,
): Promise<HealthExamProcedure> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_procedures.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId);
      const [row] = await tx
        .insert(procedures)
        .values({
          orgId: ctx.tenantId,
          companyId: originCompany(exam),
          healthExamId: exam.id,
          procedureCode: input.code,
          otherDescription: input.otherDescription ?? null,
          performedAt: input.performedAt,
          createdBy: ctx.userId,
        })
        .returning();
      return row;
    }),
  );
}

/** Remove um registro digitado errado. Prévias já arquivadas guardam a própria cópia. */
export async function removeExamProcedure(
  ctx: TenantContext,
  examId: string,
  procedureId: string,
): Promise<boolean> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_procedures.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId);
      const rows = await tx
        .delete(procedures)
        .where(
          and(
            eq(procedures.orgId, ctx.tenantId),
            eq(procedures.healthExamId, exam.id),
            eq(procedures.id, procedureId),
          ),
        )
        .returning({ id: procedures.id });
      return rows.length > 0;
    }),
  );
}

// ── Prévias arquivadas ───────────────────────────────────────────────────────

const summary = {
  id: docs.id,
  orgId: docs.orgId,
  companyId: docs.companyId,
  healthExamId: docs.healthExamId,
  version: docs.version,
  status: docs.status,
  contentSha256: docs.contentSha256,
  generatedBy: docs.generatedBy,
  generatedAt: docs.generatedAt,
};

/** Prévias do ASO do exame, da mais recente à mais antiga (sem o conteúdo). */
export async function listAsoDocuments(
  ctx: TenantContext,
  examId: string,
): Promise<AsoDocumentSummary[]> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    return tx
      .select(summary)
      .from(docs)
      .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.healthExamId, exam.id)))
      .orderBy(desc(docs.version));
  });
}

export async function getAsoDocument(
  ctx: TenantContext,
  id: string,
): Promise<AsoDocument> {
  return actorTx(ctx, async (tx) => {
    const [doc] = await tx
      .select()
      .from(docs)
      .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.id, id)))
      .limit(1);
    if (!doc) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, doc.companyId, "medicine");
    return doc;
  });
}

/** Arquiva uma nova versão (imutável). A RLS exige exame com médico examinador. */
export async function insertAsoDocument(
  ctx: TenantContext,
  examId: string,
  input: { content: unknown; contentSha256: string },
): Promise<AsoDocumentSummary> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.aso_documents.generate_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const exam = await findExam(tx, ctx.tenantId, examId);
        const [{ last }] = await tx
          .select({ last: max(docs.version) })
          .from(docs)
          .where(and(eq(docs.orgId, ctx.tenantId), eq(docs.healthExamId, exam.id)));
        const [created] = await tx
          .insert(docs)
          .values({
            orgId: ctx.tenantId,
            companyId: originCompany(exam),
            healthExamId: exam.id,
            version: (last ?? 0) + 1,
            content: input.content,
            contentSha256: input.contentSha256,
            generatedBy: ctx.userId,
          })
          .returning(summary);
        return created;
      }),
  );
}

/** Exame com prévia de ASO arquivada? (bloqueia exclusão do exame e do funcionário). */
export async function hasAsoDocumentsTx(
  tx: TenantTransaction,
  orgId: string,
  filter: { examId: string } | { employeeId: string },
): Promise<boolean> {
  const rows =
    "examId" in filter
      ? await tx
          .select({ id: docs.id })
          .from(docs)
          .where(and(eq(docs.orgId, orgId), eq(docs.healthExamId, filter.examId)))
          .limit(1)
      : await tx
          .select({ id: docs.id })
          .from(docs)
          .innerJoin(healthExams, eq(healthExams.id, docs.healthExamId))
          .where(
            and(eq(docs.orgId, orgId), eq(healthExams.employeeId, filter.employeeId)),
          )
          .limit(1);
  return rows.length > 0;
}

// ── Empresa de origem (MED-07) ───────────────────────────────────────────────

/**
 * Confirma a origem de exame anterior ao controle (empresa nula): o responsável pelo escritório
 * atesta, com justificativa, que o exame foi realizado na empresa atual do funcionário. Nada é
 * inferido; a confirmação guarda autor, data e motivo, e a empresa não muda depois (trigger).
 */
export async function confirmExamCompanyOrigin(
  ctx: TenantContext,
  examId: string,
  note: string,
): Promise<{ id: string; companyId: string; companyOrigin: "confirmed" }> {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o responsável pelo escritório pode confirmar a empresa de origem de um exame.",
    );
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_origin.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
      if (exam.companyId)
        throw new ValidationError("A empresa de origem deste exame já está registrada.");
      const [employee] = await tx
        .select({ companyId: employees.companyId })
        .from(employees)
        .where(and(eq(employees.orgId, ctx.tenantId), eq(employees.id, exam.employeeId)))
        .limit(1);
      if (!employee) throw new NotFoundError();
      await assertCompanyModuleTx(tx, ctx.tenantId, employee.companyId, "medicine");
      const [row] = await tx
        .update(healthExams)
        .set({
          companyId: employee.companyId,
          companyOrigin: "confirmed",
          companyOriginConfirmedBy: ctx.userId,
          companyOriginConfirmedAt: new Date(),
          companyOriginNote: note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(healthExams.orgId, ctx.tenantId),
            eq(healthExams.id, exam.id),
            isNull(healthExams.companyId),
          ),
        )
        .returning({ id: healthExams.id, companyId: healthExams.companyId });
      if (!row?.companyId) throw new NotFoundError();
      return {
        id: row.id,
        companyId: row.companyId,
        companyOrigin: "confirmed" as const,
      };
    }),
  );
}

// ── Confirmação do examinador ("apto com restrição") ─────────────────────────

export async function listExaminerConclusions(
  ctx: TenantContext,
  examId: string,
): Promise<AsoExaminerConclusion[]> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    return tx
      .select()
      .from(conclusions)
      .where(
        and(eq(conclusions.orgId, ctx.tenantId), eq(conclusions.healthExamId, exam.id)),
      )
      .orderBy(desc(conclusions.confirmedAt));
  });
}

/**
 * O médico examinador do exame, pela conta vinculada a ele (NOB-149), confirma apto ou inapto
 * quando o exame registra "apto com restrição". Papel no escritório não substitui o vínculo; a
 * RLS repete a regra.
 */
export async function confirmExaminerConclusion(
  ctx: TenantContext,
  examId: string,
  conclusion: "fit" | "unfit",
): Promise<AsoExaminerConclusion> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.aso_examiner_conclusions.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
        if (exam.aptitude !== "fit_with_restrictions")
          throw new ValidationError(
            "A confirmação do examinador só é usada quando o exame registra “apto com restrição”.",
          );
        if (!exam.doctorId)
          throw new ValidationError("O exame não tem médico examinador informado.");
        const companyId = originCompany(exam);
        // NOB-158: só com identidade verificada (função central), nunca o vínculo sozinho.
        const clinical = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
        if (!clinical.includes(exam.doctorId))
          throw new ForbiddenError(
            "Somente o médico examinador deste exame, com acesso vinculado e identidade verificada, pode confirmar apto ou inapto.",
          );
        const [row] = await tx
          .insert(conclusions)
          .values({
            orgId: ctx.tenantId,
            companyId,
            healthExamId: exam.id,
            conclusion,
            recordedAptitude: exam.aptitude,
            examinerMedicoId: exam.doctorId,
            confirmedBy: ctx.userId,
          })
          .returning();
        return row;
      }),
  );
}
