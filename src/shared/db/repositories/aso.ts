import "server-only";

import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { ExamProcedureValues } from "@/shared/domains/medicine/aso";
import type { AsoSignedInput, AsoSignedItem } from "@/shared/domains/medicine/aso-signed";
import type {
  AsoDeliveryEvidenceKindValue,
  AsoDeliveryEvidenceType,
  AsoDeliveryInput,
  AsoEvidenceReviewInput,
} from "@/shared/domains/medicine/aso-delivery";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  asoDocuments as docs,
  asoExaminerConclusions as conclusions,
  asoSignedDocuments as signed,
  asoDeliveries as deliveries,
  type AsoDelivery,
  type AsoDocument,
  type AsoExaminerConclusion,
  type AsoSignedDocument,
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

/**
 * Exame com prévia ou ASO assinado arquivado? Bloqueia a exclusão do exame e do funcionário: o
 * histórico documental é preservado (MED-11, MED-18).
 */
export async function hasAsoDocumentsTx(
  tx: TenantTransaction,
  orgId: string,
  filter: { examId: string } | { employeeId: string },
): Promise<boolean> {
  for (const table of [docs, signed]) {
    const rows =
      "examId" in filter
        ? await tx
            .select({ id: table.id })
            .from(table)
            .where(and(eq(table.orgId, orgId), eq(table.healthExamId, filter.examId)))
            .limit(1)
        : await tx
            .select({ id: table.id })
            .from(table)
            .innerJoin(healthExams, eq(healthExams.id, table.healthExamId))
            .where(
              and(eq(table.orgId, orgId), eq(healthExams.employeeId, filter.employeeId)),
            )
            .limit(1);
    if (rows.length > 0) return true;
  }
  return false;
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

// ── ASO assinado arquivado (NOB-163) ─────────────────────────────────────────

function toSignedItem(row: AsoSignedDocument, all: AsoSignedDocument[]): AsoSignedItem {
  return {
    id: row.id,
    origin: row.origin,
    previewDocumentId: row.previewDocumentId,
    signatureMethod: row.signatureMethod,
    verificationReference: row.verificationReference,
    signerName: row.signerName,
    signerRegistration: row.signerRegistration,
    signerUf: row.signerUf,
    conclusion: row.conclusion,
    signedOn: row.signedOn,
    fileSha256: row.fileSha256,
    sizeBytes: row.sizeBytes,
    replacesId: row.replacesId,
    replaceReason: row.replaceReason,
    registeredBy: row.registeredBy,
    registeredAt: row.registeredAt.toISOString(),
    replacedById: all.find((other) => other.replacesId === row.id)?.id ?? null,
  };
}

async function signedOfExamTx(tx: TenantTransaction, orgId: string, examId: string) {
  return tx
    .select()
    .from(signed)
    .where(and(eq(signed.orgId, orgId), eq(signed.healthExamId, examId)))
    .orderBy(asc(signed.registeredAt));
}

/** ASOs assinados do exame, do mais antigo ao mais recente, com a cadeia de substituição. */
export async function listSignedAsos(
  ctx: TenantContext,
  examId: string,
): Promise<AsoSignedItem[]> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    const rows = await signedOfExamTx(tx, ctx.tenantId, exam.id);
    return rows.map((row) => toSignedItem(row, rows));
  });
}

/** Registro para download (o caminho nunca vem do cliente). */
export async function getSignedAso(
  ctx: TenantContext,
  id: string,
): Promise<AsoSignedDocument> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(signed)
      .where(and(eq(signed.orgId, ctx.tenantId), eq(signed.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, row.companyId, "medicine");
    return row;
  });
}

export type SignedAsoFile = {
  id: string;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
};

/**
 * Registra o ASO assinado já gravado no storage. Confere no servidor (e a RLS confere de novo):
 * - fluxo A: examinador do exame com identidade verificada, CRM/UF do cadastro dele, prévia do
 *   mesmo exame e conclusão igual à da prévia;
 * - fluxo B: equipe do escritório (o portão do escritório já barrou cliente);
 * - um ASO vigente por exame: com vigente, o novo precisa substituí-lo, com motivo.
 */
export async function insertSignedAso(
  ctx: TenantContext,
  examId: string,
  input: AsoSignedInput,
  file: SignedAsoFile,
  checkSignedOn: (performedAt: string) => string | null,
): Promise<AsoSignedItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.aso_signed.register_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
      const companyId = originCompany(exam);
      const dateProblem = checkSignedOn(exam.performedAt);
      if (dateProblem) throw new ValidationError(dateProblem);

      if (input.origin === "examiner") {
        if (!exam.doctorId)
          throw new ValidationError("O exame não tem médico examinador informado.");
        const allowed = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
        if (!allowed.includes(exam.doctorId))
          throw new ForbiddenError(
            "Só o médico examinador do exame, pela conta vinculada e com identidade verificada, registra o ASO assinado por ele.",
          );
        const [examiner] = await tx
          .select({ crm: medicos.crm, uf: medicos.registrationUf })
          .from(medicos)
          .where(and(eq(medicos.orgId, ctx.tenantId), eq(medicos.id, exam.doctorId)))
          .limit(1);
        if (
          !examiner ||
          examiner.crm !== input.signerRegistration ||
          examiner.uf !== input.signerUf
        )
          throw new ValidationError(
            "O CRM/UF do signatário não é o do médico examinador do exame.",
          );
        const [preview] = await tx
          .select({ content: docs.content })
          .from(docs)
          .where(
            and(
              eq(docs.orgId, ctx.tenantId),
              eq(docs.healthExamId, exam.id),
              eq(docs.id, input.previewDocumentId!),
            ),
          )
          .limit(1);
        if (!preview) throw new ValidationError("A prévia informada não é deste exame.");
        const previewConclusion = (
          preview.content as { conclusion?: { result?: string } }
        ).conclusion?.result;
        if (previewConclusion !== input.conclusion)
          throw new ValidationError(
            "A conclusão informada não é a da prévia assinada. Gere uma nova prévia se a conclusão do exame mudou.",
          );
      }

      const existing = await signedOfExamTx(tx, ctx.tenantId, exam.id);
      const replacedIds = new Set(existing.map((r) => r.replacesId).filter(Boolean));
      const current = existing.find((r) => !replacedIds.has(r.id)) ?? null;
      if (current && input.replacesId !== current.id)
        throw new ValidationError(
          "O exame já tem ASO assinado vigente. Para corrigir, registre a substituição do documento vigente, com motivo.",
        );
      if (!current && input.replacesId)
        throw new ValidationError(
          "O documento a substituir não é o ASO vigente deste exame.",
        );

      try {
        const [row] = await tx
          .insert(signed)
          .values({
            id: file.id,
            orgId: ctx.tenantId,
            companyId,
            healthExamId: exam.id,
            origin: input.origin,
            previewDocumentId: input.previewDocumentId ?? null,
            signatureMethod: input.signatureMethod,
            verificationReference: input.verificationReference,
            signerName: input.signerName,
            signerRegistration: input.signerRegistration,
            signerUf: input.signerUf,
            conclusion: input.conclusion,
            signedOn: input.signedOn,
            storagePath: file.storagePath,
            fileSha256: file.sha256,
            sizeBytes: file.sizeBytes,
            replacesId: input.replacesId ?? null,
            replaceReason: input.replaceReason,
            registeredBy: ctx.userId,
          })
          .returning();
        return toSignedItem(row, [...existing, row]);
      } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (code === "42501")
          throw new ForbiddenError(
            "Registro recusado pelo banco: confira se você é o examinador verificado do exame (fluxo A) ou da equipe do escritório (fluxo B).",
          );
        if (code === "23505")
          throw new ValidationError("Este documento já foi substituído.");
        throw error;
      }
    }),
  );
}

// ── Entrega do ASO ao trabalhador (NOB-165) ──────────────────────────────────

/** Registro de entrega sem o caminho do comprovante (que nunca sai do servidor). */
export type AsoDeliveryItem = Omit<
  AsoDelivery,
  "evidencePath" | "occurredAt" | "recordedAt"
> & {
  occurredAt: string;
  recordedAt: string;
  hasEvidence: boolean;
};

function toDeliveryItem(row: AsoDelivery): AsoDeliveryItem {
  const { evidencePath, ...rest } = row;
  return {
    ...rest,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    hasEvidence: evidencePath !== null,
  };
}

/** Eventos de entrega do exame (todas as versões do ASO assinado), do mais antigo ao mais recente. */
export async function listAsoDeliveries(
  ctx: TenantContext,
  examId: string,
): Promise<{ deliveries: AsoDeliveryItem[]; signed: AsoSignedItem[] }> {
  return actorTx(ctx, async (tx) => {
    const exam = await findExam(tx, ctx.tenantId, examId);
    const rows = await tx
      .select()
      .from(deliveries)
      .where(
        and(eq(deliveries.orgId, ctx.tenantId), eq(deliveries.healthExamId, exam.id)),
      )
      .orderBy(asc(deliveries.recordedAt));
    const signedRows = await signedOfExamTx(tx, ctx.tenantId, exam.id);
    return {
      deliveries: rows.map(toDeliveryItem),
      signed: signedRows.map((row) => toSignedItem(row, signedRows)),
    };
  });
}

/** Registro para baixar o comprovante (o caminho sai do registro do tenant). */
export async function getAsoDelivery(
  ctx: TenantContext,
  id: string,
): Promise<AsoDelivery> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.orgId, ctx.tenantId), eq(deliveries.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, row.companyId, "medicine");
    return row;
  });
}

export type AsoDeliveryEvidenceFile = {
  path: string;
  sha256: string;
  sizeBytes: number;
  contentType: AsoDeliveryEvidenceType;
  kind: AsoDeliveryEvidenceKindValue;
};

function deliveryRejected(error: unknown): never {
  const code = (error as { cause?: { code?: string } }).cause?.code;
  if (code === "42501")
    throw new ForbiddenError(
      "Registro recusado pelo banco: só a equipe do escritório registra a entrega, para o ASO assinado vigente do exame.",
    );
  if (code === "23505") throw new ValidationError("Este registro já foi corrigido.");
  throw error;
}

/**
 * Registra uma entrega ou um pedido de via física para o ASO assinado **vigente** do exame (nunca a
 * prévia): o documento e o hash são lidos do banco, não do cliente. A RLS confere de novo.
 */
export async function insertAsoDelivery(
  ctx: TenantContext,
  examId: string,
  id: string,
  input: AsoDeliveryInput,
  evidence: AsoDeliveryEvidenceFile | null,
  checkOccurredAt: (signedOn: string) => string | null,
): Promise<AsoDeliveryItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.aso_delivery.register_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
      const companyId = originCompany(exam);
      const signedRows = await signedOfExamTx(tx, ctx.tenantId, exam.id);
      const replaced = new Set(signedRows.map((r) => r.replacesId).filter(Boolean));
      const current = signedRows.find((r) => !replaced.has(r.id));
      if (!current)
        throw new ValidationError(
          "O exame não tem ASO assinado registrado. A prévia não é ASO e não pode ser entregue.",
        );
      const problem = checkOccurredAt(current.signedOn);
      if (problem) throw new ValidationError(problem);
      try {
        const [row] = await tx
          .insert(deliveries)
          .values({
            id,
            orgId: ctx.tenantId,
            companyId,
            healthExamId: exam.id,
            employeeId: exam.employeeId,
            signedDocumentId: current.id,
            documentSha256: current.fileSha256,
            kind: input.kind,
            method: input.kind === "made_available" ? input.method! : null,
            channelDescription: input.channelDescription,
            occurredAt: input.occurredAt,
            evidenceReference: input.evidenceReference,
            evidenceKind: evidence?.kind ?? null,
            evidencePath: evidence?.path ?? null,
            evidenceSha256: evidence?.sha256 ?? null,
            evidenceSizeBytes: evidence?.sizeBytes ?? null,
            evidenceContentType: evidence?.contentType ?? null,
            recordedBy: ctx.userId,
          })
          .returning();
        return toDeliveryItem(row);
      } catch (error) {
        deliveryRejected(error);
      }
    }),
  );
}

/** Corrige um registro anterior (entrega ou pedido) com motivo; o original é preservado. */
export async function voidAsoDelivery(
  ctx: TenantContext,
  examId: string,
  deliveryId: string,
  reason: string,
  newId: string,
): Promise<AsoDeliveryItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.aso_delivery.void_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
      const [target] = await tx
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.orgId, ctx.tenantId),
            eq(deliveries.healthExamId, exam.id),
            eq(deliveries.id, deliveryId),
          ),
        )
        .limit(1);
      if (!target) throw new NotFoundError();
      if (target.kind === "voided")
        throw new ValidationError(
          "Uma correção não é corrigida: registre a entrega de novo.",
        );
      try {
        const [row] = await tx
          .insert(deliveries)
          .values({
            id: newId,
            orgId: ctx.tenantId,
            companyId: target.companyId,
            healthExamId: exam.id,
            employeeId: target.employeeId,
            signedDocumentId: target.signedDocumentId,
            documentSha256: target.documentSha256,
            kind: "voided",
            occurredAt: new Date(),
            voidsId: target.id,
            voidReason: reason,
            recordedBy: ctx.userId,
          })
          .returning();
        return toDeliveryItem(row);
      } catch (error) {
        deliveryRejected(error);
      }
    }),
  );
}

/**
 * Conferência humana do comprovante (NOB-167): ato separado do upload, registrado pelo usuário da
 * sessão, ligado ao comprovante exato (id, hash e tipo copiados do registro conferido, nunca do
 * cliente). Recusa comprovante inexistente, sem arquivo, corrigido ou já conferido; o banco confere
 * de novo (FK composta, trigger de comprovante corrigido, policy de documento vigente).
 */
export async function insertAsoEvidenceReview(
  ctx: TenantContext,
  examId: string,
  deliveryId: string,
  input: AsoEvidenceReviewInput,
  newId: string,
): Promise<AsoDeliveryItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.aso_delivery.review_rejected", () =>
    actorTx(ctx, async (tx) => {
      const exam = await findExam(tx, ctx.tenantId, examId, { lock: true });
      const [target] = await tx
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.orgId, ctx.tenantId),
            eq(deliveries.healthExamId, exam.id),
            eq(deliveries.id, deliveryId),
          ),
        )
        .limit(1);
      if (!target) throw new NotFoundError();
      if (
        target.kind !== "made_available" ||
        !target.evidencePath ||
        !target.evidenceSha256 ||
        !target.evidenceKind
      )
        throw new ValidationError(
          "Só um comprovante anexado a uma entrega pode ser conferido.",
        );
      if (
        input.method === "signature_witnessed" &&
        target.evidenceKind !== "signed_receipt"
      )
        throw new ValidationError(
          "Assinatura presenciada só vale para recibo assinado pelo trabalhador.",
        );
      const [voided] = await tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.orgId, ctx.tenantId),
            eq(deliveries.healthExamId, exam.id),
            eq(deliveries.voidsId, target.id),
          ),
        )
        .limit(1);
      if (voided)
        throw new ValidationError("Comprovante corrigido não pode ser conferido.");
      try {
        const [row] = await tx
          .insert(deliveries)
          .values({
            id: newId,
            orgId: ctx.tenantId,
            companyId: target.companyId,
            healthExamId: exam.id,
            employeeId: target.employeeId,
            signedDocumentId: target.signedDocumentId,
            documentSha256: target.documentSha256,
            kind: "evidence_reviewed",
            occurredAt: new Date(),
            reviewsId: target.id,
            reviewedEvidenceSha256: target.evidenceSha256,
            reviewedEvidenceKind: target.evidenceKind,
            reviewMethod: input.method,
            reviewResult: input.result,
            reviewReference: input.reference,
            recordedBy: ctx.userId,
          })
          .returning();
        return toDeliveryItem(row);
      } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (code === "23505")
          throw new ValidationError("Este comprovante já foi conferido.");
        if (code === "42501")
          throw new ForbiddenError(
            "Conferência recusada pelo banco: só a equipe do escritório confere, para comprovante válido do ASO assinado vigente.",
          );
        throw error;
      }
    }),
  );
}
