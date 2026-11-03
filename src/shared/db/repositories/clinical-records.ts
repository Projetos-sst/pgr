import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import type {
  ClinicalAccessBasis,
  ClinicalAccessEventView,
  ClinicalNoteView,
  ClinicalRecordView,
  WorkRestrictionValues,
  WorkRestrictionView,
} from "@/shared/domains/medicine/clinical-record";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  clinicalRecordAccessEvents as accessEvents,
  healthExamClinicalNotes as clinicalNotes,
  healthExamWorkRestrictions as workRestrictions,
} from "../schema/clinical-records";
import { healthExams } from "../schema/health-exams";
import { medicos, pcmsoCoordinatorAssignments as assignments } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";

/** Transação com o ator da sessão: as policies do prontuário conferem o vínculo da conta. */
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

const CLINICAL_FK_CONSTRAINTS = [
  "fk_health_exam_clinical_notes_exam",
  "fk_health_exam_work_restrictions_exam",
  // NOB-139: área clínica do afastamento barra a cascata da exclusão do funcionário.
  "fk_absence_clinical_notes_absence",
];

/**
 * A exclusão esbarrou na FK RESTRICT do prontuário ou da comunicação de restrição (NOB-155)? O RH
 * não lê essas tabelas (RLS), então o banco é quem barra; a aplicação só traduz para IN_USE.
 */
export function isClinicalHistoryFkViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const { code, constraint_name: constraint } = current as {
        code: unknown;
        constraint_name?: unknown;
      };
      if (
        code === "23503" &&
        typeof constraint === "string" &&
        CLINICAL_FK_CONSTRAINTS.includes(constraint)
      )
        return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

type ExamRef = { id: string; doctorId: string | null; companyId: string | null };

/** Exame do tenant (a RLS de módulo de `health_exams` também vale). Outro tenant → 404. */
async function examTx(tx: TenantTransaction, orgId: string, examId: string) {
  const [exam] = await tx
    .select({
      id: healthExams.id,
      doctorId: healthExams.doctorId,
      companyId: healthExams.companyId,
    })
    .from(healthExams)
    .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, examId)))
    .limit(1);
  if (!exam) throw new NotFoundError();
  return exam;
}

/**
 * Base do acesso clínico da conta da sessão ao exame: vínculo aberto (NOB-149), médico ativo,
 * associação viva, e o médico é o examinador do exame ou o coordenador com designação aberta da
 * empresa onde o exame foi realizado (MED-07). Exame sem origem comprovada → só o examinador.
 * Mesma regra das policies da 0067.
 */
async function clinicalAccessTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  exam: ExamRef,
): Promise<{ medicoId: string; basis: ClinicalAccessBasis } | null> {
  // NOB-158: só profissionais com identidade verificada (função central do banco).
  const clinical = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
  if (exam.doctorId && clinical.includes(exam.doctorId))
    return { medicoId: exam.doctorId, basis: "examiner" };
  if (!exam.companyId || clinical.length === 0) return null;
  const [assignment] = await tx
    .select({ medicoId: assignments.medicoId })
    .from(assignments)
    .where(
      and(
        eq(assignments.orgId, ctx.tenantId),
        eq(assignments.companyId, exam.companyId),
        inArray(assignments.medicoId, clinical),
        isNull(assignments.endsOn),
      ),
    )
    .limit(1);
  return assignment ? { medicoId: assignment.medicoId, basis: "coordinator" } : null;
}

const DENIED =
  "O prontuário clínico é acessível só ao médico examinador do exame ou ao coordenador do PCMSO da empresa, pela conta vinculada.";

async function requireClinicalAccessTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  examId: string,
) {
  const exam = await examTx(tx, ctx.tenantId, examId);
  const access = await clinicalAccessTx(tx, ctx, exam);
  if (!access) throw new ForbiddenError(DENIED);
  return { exam, ...access };
}

async function recordAccessTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  access: { exam: ExamRef; medicoId: string; basis: ClinicalAccessBasis },
  action: "read" | "note_added" | "restriction_recorded",
) {
  // Só identificadores e a ação: nenhum conteúdo clínico na trilha.
  await tx.insert(accessEvents).values({
    orgId: ctx.tenantId,
    healthExamId: access.exam.id,
    medicoId: access.medicoId,
    basis: access.basis,
    action,
    actorUserId: ctx.userId,
  });
}

/** A conta da sessão pode abrir o prontuário? Sem registrar acesso (só decide o que a tela mostra). */
export async function getClinicalAccess(
  ctx: TenantContext,
  examId: string,
): Promise<{ allowed: boolean; basis: ClinicalAccessBasis | null }> {
  return actorTx(ctx, async (tx) => {
    const exam = await examTx(tx, ctx.tenantId, examId);
    const access = await clinicalAccessTx(tx, ctx, exam);
    return { allowed: !!access, basis: access?.basis ?? null };
  });
}

async function listNotesTx(
  tx: TenantTransaction,
  orgId: string,
  examId: string,
): Promise<ClinicalNoteView[]> {
  const rows = await tx
    .select({
      id: clinicalNotes.id,
      origin: clinicalNotes.origin,
      content: clinicalNotes.content,
      authorName: medicos.name,
      authorRegistration: medicos.crm,
      recordedAt: clinicalNotes.recordedAt,
    })
    .from(clinicalNotes)
    .leftJoin(
      medicos,
      and(
        eq(medicos.id, clinicalNotes.authoredByMedicoId),
        eq(medicos.orgId, clinicalNotes.orgId),
      ),
    )
    .where(and(eq(clinicalNotes.orgId, orgId), eq(clinicalNotes.healthExamId, examId)))
    .orderBy(desc(clinicalNotes.recordedAt), desc(clinicalNotes.id));
  return rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() }));
}

/** Lê o prontuário do exame e registra a leitura na trilha, na mesma transação. */
export async function readClinicalRecord(
  ctx: TenantContext,
  examId: string,
): Promise<ClinicalRecordView> {
  return actorTx(ctx, async (tx) => {
    const access = await requireClinicalAccessTx(tx, ctx, examId);
    await recordAccessTx(tx, ctx, access, "read");
    return { basis: access.basis, notes: await listNotesTx(tx, ctx.tenantId, examId) };
  });
}

/** Nova observação clínica (só inclusão), em nome do médico da conta vinculada. */
export async function addClinicalNote(
  ctx: TenantContext,
  examId: string,
  content: string,
): Promise<ClinicalNoteView> {
  return auditedTenantWrite(ctx.tenantId, "medicine.clinical_notes.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const access = await requireClinicalAccessTx(tx, ctx, examId);
      const [row] = await tx
        .insert(clinicalNotes)
        .values({
          orgId: ctx.tenantId,
          healthExamId: access.exam.id,
          origin: "clinician",
          content,
          authoredByMedicoId: access.medicoId,
          recordedBy: ctx.userId,
        })
        .returning({ id: clinicalNotes.id });
      await recordAccessTx(tx, ctx, access, "note_added");
      const notes = await listNotesTx(tx, ctx.tenantId, examId);
      return notes.find((n) => n.id === row.id)!;
    }),
  );
}

async function listRestrictionsTx(
  tx: TenantTransaction,
  orgId: string,
  examId: string,
): Promise<WorkRestrictionView[]> {
  const rows = await tx
    .select({
      id: workRestrictions.id,
      kind: workRestrictions.kind,
      restriction: workRestrictions.restriction,
      authorName: medicos.name,
      recordedAt: workRestrictions.recordedAt,
    })
    .from(workRestrictions)
    .leftJoin(
      medicos,
      and(
        eq(medicos.id, workRestrictions.authoredByMedicoId),
        eq(medicos.orgId, workRestrictions.orgId),
      ),
    )
    .where(
      and(eq(workRestrictions.orgId, orgId), eq(workRestrictions.healthExamId, examId)),
    )
    .orderBy(desc(workRestrictions.recordedAt), desc(workRestrictions.id));
  return rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() }));
}

/**
 * Comunicações de restrição ao trabalho do exame, da mais recente (vigente) à mais antiga. É o
 * que o RH lê do médico: a restrição funcional, sem diagnóstico.
 */
export async function listWorkRestrictions(
  ctx: TenantContext,
  examId: string,
): Promise<WorkRestrictionView[]> {
  return actorTx(ctx, async (tx) => {
    await examTx(tx, ctx.tenantId, examId);
    return listRestrictionsTx(tx, ctx.tenantId, examId);
  });
}

/** O médico examinador ou coordenador registra (ou retira) a restrição comunicada ao RH. */
export async function recordWorkRestriction(
  ctx: TenantContext,
  examId: string,
  input: WorkRestrictionValues,
): Promise<WorkRestrictionView> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.work_restrictions.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const access = await requireClinicalAccessTx(tx, ctx, examId);
        const [row] = await tx
          .insert(workRestrictions)
          .values({
            orgId: ctx.tenantId,
            healthExamId: access.exam.id,
            kind: input.kind,
            restriction: input.kind === "restriction" ? input.restriction : null,
            authoredByMedicoId: access.medicoId,
            recordedBy: ctx.userId,
          })
          .returning({ id: workRestrictions.id });
        await recordAccessTx(tx, ctx, access, "restriction_recorded");
        const rows = await listRestrictionsTx(tx, ctx.tenantId, examId);
        return rows.find((r) => r.id === row.id)!;
      }),
  );
}

/** Trilha de acesso ao prontuário do exame (sem conteúdo clínico). O servidor limita ao owner. */
export async function listClinicalAccessEvents(
  ctx: TenantContext,
  examId: string,
): Promise<ClinicalAccessEventView[]> {
  return actorTx(ctx, async (tx) => {
    await examTx(tx, ctx.tenantId, examId);
    const rows = await tx
      .select({
        id: accessEvents.id,
        action: accessEvents.action,
        basis: accessEvents.basis,
        medicoName: medicos.name,
        occurredAt: accessEvents.occurredAt,
      })
      .from(accessEvents)
      .leftJoin(
        medicos,
        and(eq(medicos.id, accessEvents.medicoId), eq(medicos.orgId, accessEvents.orgId)),
      )
      .where(
        and(eq(accessEvents.orgId, ctx.tenantId), eq(accessEvents.healthExamId, examId)),
      )
      .orderBy(desc(accessEvents.occurredAt), desc(accessEvents.id))
      .limit(200);
    return rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() }));
  });
}
