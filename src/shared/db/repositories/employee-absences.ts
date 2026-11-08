import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  periodsOverlap,
  type AbsenceClinicalNoteValues,
  type AbsenceValues,
} from "@/shared/domains/medicine/absences";
import { addDays } from "@/shared/domains/medicine/nr7-schedule-rules";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  absenceClinicalAccessEvents as accessEvents,
  employeeAbsenceClinicalNotes as clinicalNotes,
  employeeAbsenceEvents as events,
  employeeAbsences as absences,
  type EmployeeAbsence,
} from "../schema/employee-absences";
import { employees } from "../schema/employees";
import { healthExams } from "../schema/health-exams";
import { medicos } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";
import { actorClinicalMedicoIdsTx } from "./clinical-actor";
import { assertCompanyModuleTx } from "./company-modules";
import { assignmentInForceTodayTx } from "./pcmso-coordinator-in-force";

/** Transação com o ator da sessão: as policies conferem autoria e, na área clínica, o vínculo. */
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

/** Colunas administrativas do afastamento (nenhum dado clínico existe nesta tabela). */
export type AbsenceRow = Pick<
  EmployeeAbsence,
  | "id"
  | "companyId"
  | "employeeId"
  | "cause"
  | "workRelation"
  | "startsOn"
  | "endsOn"
  | "returnedOn"
  | "cancelledAt"
  | "cancelReason"
  | "createdAt"
>;

const columns = {
  id: absences.id,
  companyId: absences.companyId,
  employeeId: absences.employeeId,
  cause: absences.cause,
  workRelation: absences.workRelation,
  startsOn: absences.startsOn,
  endsOn: absences.endsOn,
  returnedOn: absences.returnedOn,
  cancelledAt: absences.cancelledAt,
  cancelReason: absences.cancelReason,
  createdAt: absences.createdAt,
};

async function employeeTx(tx: TenantTransaction, orgId: string, employeeId: string) {
  const [emp] = await tx
    .select({ id: employees.id, companyId: employees.companyId })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
    .limit(1);
  return emp ?? null;
}

async function absenceTx(tx: TenantTransaction, orgId: string, id: string) {
  const [row] = await tx
    .select(columns)
    .from(absences)
    .where(and(eq(absences.orgId, orgId), eq(absences.id, id)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

/** Serializa as escritas por funcionário (checagem de sobreposição) sem exigir UPDATE em employees. */
async function lockEmployee(tx: TenantTransaction, employeeId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${employeeId}, 0))`);
}

async function assertNoOverlapTx(
  tx: TenantTransaction,
  orgId: string,
  employeeId: string,
  period: { startsOn: string; endsOn: string | null; returnedOn: string | null },
  exceptId?: string,
) {
  const others = await tx
    .select(columns)
    .from(absences)
    .where(
      and(
        eq(absences.orgId, orgId),
        eq(absences.employeeId, employeeId),
        isNull(absences.cancelledAt),
      ),
    );
  const clash = others.find((o) => o.id !== exceptId && periodsOverlap(o, period));
  if (clash)
    throw new ValidationError(
      `O período se sobrepõe a outro afastamento do funcionário (início em ${clash.startsOn}). Ajuste as datas ou cancele o registro anterior.`,
    );
}

/** Afastamentos do funcionário (inclusive cancelados, para o histórico), do mais recente ao mais antigo. */
export async function listEmployeeAbsences(
  ctx: TenantContext,
  employeeId: string,
): Promise<{ rows: AbsenceRow[]; returnExamDates: string[] }> {
  return actorTx(ctx, async (tx) => {
    const emp = await employeeTx(tx, ctx.tenantId, employeeId);
    if (!emp) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, emp.companyId, "medicine");
    const rows = await tx
      .select(columns)
      .from(absences)
      .where(and(eq(absences.orgId, ctx.tenantId), eq(absences.employeeId, employeeId)))
      .orderBy(desc(absences.startsOn), desc(absences.createdAt));
    return {
      rows,
      returnExamDates: await returnExamDatesTx(tx, ctx.tenantId, employeeId),
    };
  });
}

/** Datas dos exames de retorno ao trabalho registrados (só tipo e data; nada clínico). */
async function returnExamDatesTx(
  tx: TenantTransaction,
  orgId: string,
  employeeId: string,
) {
  const rows = await tx
    .select({ performedAt: healthExams.performedAt })
    .from(healthExams)
    .where(
      and(
        eq(healthExams.orgId, orgId),
        eq(healthExams.employeeId, employeeId),
        eq(healthExams.examType, "return_to_work"),
      ),
    );
  return rows.map((r) => r.performedAt);
}

export async function getEmployeeAbsence(
  ctx: TenantContext,
  id: string,
): Promise<{
  absence: AbsenceRow;
  returnExamDates: string[];
  events: {
    kind: string;
    endsOn: string | null;
    returnedOn: string | null;
    actorUserId: string;
    occurredAt: string;
  }[];
}> {
  return actorTx(ctx, async (tx) => {
    const absence = await absenceTx(tx, ctx.tenantId, id);
    const history = await tx
      .select({
        kind: events.kind,
        endsOn: events.endsOn,
        returnedOn: events.returnedOn,
        actorUserId: events.actorUserId,
        occurredAt: events.occurredAt,
      })
      .from(events)
      .where(and(eq(events.orgId, ctx.tenantId), eq(events.absenceId, id)))
      .orderBy(events.occurredAt, events.id);
    return {
      absence,
      returnExamDates: await returnExamDatesTx(tx, ctx.tenantId, absence.employeeId),
      events: history.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() })),
    };
  });
}

async function eventTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  absence: { id: string; companyId: string },
  kind: "created" | "end_updated" | "returned" | "cancelled",
  values: { endsOn?: string | null; returnedOn?: string | null } = {},
) {
  await tx.insert(events).values({
    orgId: ctx.tenantId,
    companyId: absence.companyId,
    absenceId: absence.id,
    kind,
    endsOn: values.endsOn ?? null,
    returnedOn: values.returnedOn ?? null,
    actorUserId: ctx.userId,
  });
}

/** Registra o afastamento na empresa ATUAL do funcionário (servidor, nunca do cliente). */
export async function createEmployeeAbsence(
  ctx: TenantContext,
  input: AbsenceValues,
): Promise<AbsenceRow> {
  return auditedTenantWrite(ctx.tenantId, "medicine.absences.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const emp = await employeeTx(tx, ctx.tenantId, input.employeeId);
      if (!emp)
        throw new ReferenceNotFoundError("Funcionário não encontrado neste escritório.");
      await assertCompanyModuleTx(tx, ctx.tenantId, emp.companyId, "medicine");
      await lockEmployee(tx, emp.id);
      const period = {
        startsOn: input.startsOn,
        endsOn: input.endsOn ?? null,
        returnedOn: null,
      };
      await assertNoOverlapTx(tx, ctx.tenantId, emp.id, period);
      const [row] = await tx
        .insert(absences)
        .values({
          orgId: ctx.tenantId,
          companyId: emp.companyId,
          employeeId: emp.id,
          cause: input.cause,
          workRelation: input.workRelation,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          createdBy: ctx.userId,
          lastChangedBy: ctx.userId,
        })
        .returning(columns);
      await eventTx(tx, ctx, row, "created", { endsOn: row.endsOn });
      return row;
    }),
  );
}

async function openAbsenceTx(tx: TenantTransaction, ctx: TenantContext, id: string) {
  const row = await absenceTx(tx, ctx.tenantId, id);
  await assertCompanyModuleTx(tx, ctx.tenantId, row.companyId, "medicine");
  if (row.cancelledAt)
    throw new ValidationError("Afastamento cancelado não pode ser alterado.");
  if (row.returnedOn)
    throw new ValidationError(
      "Afastamento com retorno confirmado não pode ser alterado.",
    );
  await lockEmployee(tx, row.employeeId);
  return row;
}

/** Informa ou corrige o último dia previsto/conhecido de um afastamento aberto. */
export async function updateAbsenceEnd(
  ctx: TenantContext,
  id: string,
  endsOn: string | null,
): Promise<AbsenceRow> {
  return auditedTenantWrite(ctx.tenantId, "medicine.absences.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const row = await openAbsenceTx(tx, ctx, id);
      if (endsOn && endsOn < row.startsOn)
        throw new ValidationError(
          "O último dia de afastamento não pode ser anterior ao início.",
        );
      await assertNoOverlapTx(
        tx,
        ctx.tenantId,
        row.employeeId,
        { startsOn: row.startsOn, endsOn, returnedOn: null },
        row.id,
      );
      const [updated] = await tx
        .update(absences)
        .set({ endsOn, lastChangedBy: ctx.userId, lastChangedAt: new Date() })
        .where(and(eq(absences.orgId, ctx.tenantId), eq(absences.id, id)))
        .returning(columns);
      await eventTx(tx, ctx, updated, "end_updated", { endsOn });
      return updated;
    }),
  );
}

/** Confirma o retorno: o último dia de ausência passa a ser a véspera do retorno. */
export async function confirmAbsenceReturn(
  ctx: TenantContext,
  id: string,
  returnedOn: string,
): Promise<AbsenceRow> {
  return auditedTenantWrite(ctx.tenantId, "medicine.absences.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      const row = await openAbsenceTx(tx, ctx, id);
      if (returnedOn <= row.startsOn)
        throw new ValidationError(
          "O retorno precisa ser posterior ao início do afastamento.",
        );
      const endsOn = addDays(returnedOn, -1);
      await assertNoOverlapTx(
        tx,
        ctx.tenantId,
        row.employeeId,
        { startsOn: row.startsOn, endsOn, returnedOn },
        row.id,
      );
      const now = new Date();
      const [updated] = await tx
        .update(absences)
        .set({
          endsOn,
          returnedOn,
          returnRecordedBy: ctx.userId,
          returnRecordedAt: now,
          lastChangedBy: ctx.userId,
          lastChangedAt: now,
        })
        .where(and(eq(absences.orgId, ctx.tenantId), eq(absences.id, id)))
        .returning(columns);
      await eventTx(tx, ctx, updated, "returned", { endsOn, returnedOn });
      return updated;
    }),
  );
}

/** Cancela um registro aberto feito por engano; o histórico fica (sem DELETE). */
export async function cancelEmployeeAbsence(
  ctx: TenantContext,
  id: string,
  reason: string,
): Promise<AbsenceRow> {
  return auditedTenantWrite(ctx.tenantId, "medicine.absences.write_rejected", () =>
    actorTx(ctx, async (tx) => {
      await openAbsenceTx(tx, ctx, id);
      const now = new Date();
      const [updated] = await tx
        .update(absences)
        .set({
          cancelledAt: now,
          cancelledBy: ctx.userId,
          cancelReason: reason,
          lastChangedBy: ctx.userId,
          lastChangedAt: now,
        })
        .where(and(eq(absences.orgId, ctx.tenantId), eq(absences.id, id)))
        .returning(columns);
      await eventTx(tx, ctx, updated, "cancelled");
      return updated;
    }),
  );
}

// ── Área clínica (atestado e CID): só o coordenador vinculado ───────────────

const DENIED =
  "A área clínica do afastamento é acessível só ao médico coordenador do PCMSO da empresa, pela conta vinculada.";

async function coordinatorTx(
  tx: TenantTransaction,
  ctx: TenantContext,
  companyId: string,
) {
  // NOB-158: coordenador com identidade verificada (função central do banco).
  const clinical = await actorClinicalMedicoIdsTx(tx, ctx.tenantId);
  if (clinical.length === 0) throw new ForbiddenError(DENIED);
  // Coordenador = designação em vigor hoje e única (NOB-109), não a "aberta".
  const row = await assignmentInForceTodayTx(tx, ctx.tenantId, companyId);
  if (!row || !clinical.includes(row.medicoId)) throw new ForbiddenError(DENIED);
  return row.medicoId;
}

export type AbsenceClinicalNoteView = {
  id: string;
  cid: string | null;
  workerAuthorization: string | null;
  content: string | null;
  authorName: string | null;
  recordedAt: string;
};

async function listNotesTx(tx: TenantTransaction, orgId: string, absenceId: string) {
  const rows = await tx
    .select({
      id: clinicalNotes.id,
      cid: clinicalNotes.cid,
      workerAuthorization: clinicalNotes.workerAuthorization,
      content: clinicalNotes.content,
      authorName: medicos.name,
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
    .where(and(eq(clinicalNotes.orgId, orgId), eq(clinicalNotes.absenceId, absenceId)))
    .orderBy(desc(clinicalNotes.recordedAt), desc(clinicalNotes.id));
  return rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() }));
}

/** Lê a área clínica do afastamento e registra a leitura na trilha (sem conteúdo). */
export async function readAbsenceClinicalNotes(
  ctx: TenantContext,
  absenceId: string,
): Promise<AbsenceClinicalNoteView[]> {
  return actorTx(ctx, async (tx) => {
    const absence = await absenceTx(tx, ctx.tenantId, absenceId);
    const medicoId = await coordinatorTx(tx, ctx, absence.companyId);
    await tx.insert(accessEvents).values({
      orgId: ctx.tenantId,
      companyId: absence.companyId,
      absenceId,
      medicoId,
      action: "read",
      actorUserId: ctx.userId,
    });
    return listNotesTx(tx, ctx.tenantId, absenceId);
  });
}

export async function addAbsenceClinicalNote(
  ctx: TenantContext,
  absenceId: string,
  input: AbsenceClinicalNoteValues,
): Promise<AbsenceClinicalNoteView> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.absence_clinical.write_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const absence = await absenceTx(tx, ctx.tenantId, absenceId);
        const medicoId = await coordinatorTx(tx, ctx, absence.companyId);
        const [row] = await tx
          .insert(clinicalNotes)
          .values({
            orgId: ctx.tenantId,
            companyId: absence.companyId,
            absenceId,
            cid: input.cid ?? null,
            workerAuthorization: input.workerAuthorization || null,
            content: input.content || null,
            authoredByMedicoId: medicoId,
            recordedBy: ctx.userId,
          })
          .returning({ id: clinicalNotes.id });
        await tx.insert(accessEvents).values({
          orgId: ctx.tenantId,
          companyId: absence.companyId,
          absenceId,
          medicoId,
          action: "note_added",
          actorUserId: ctx.userId,
        });
        return (await listNotesTx(tx, ctx.tenantId, absenceId)).find(
          (n) => n.id === row.id,
        )!;
      }),
  );
}

/** A conta da sessão pode abrir a área clínica do afastamento? (Sem registrar acesso.) */
export async function canAccessAbsenceClinical(
  ctx: TenantContext,
  absenceId: string,
): Promise<boolean> {
  return actorTx(ctx, async (tx) => {
    const absence = await absenceTx(tx, ctx.tenantId, absenceId);
    try {
      await coordinatorTx(tx, ctx, absence.companyId);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) return false;
      throw error;
    }
  });
}
