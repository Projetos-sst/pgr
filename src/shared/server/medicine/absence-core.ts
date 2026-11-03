import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/employee-absences";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  absenceCancelSchema,
  absenceClinicalNoteSchema,
  absenceEndSchema,
  absenceInputSchema,
  absenceReturnSchema,
  assessAbsence,
} from "@/shared/domains/medicine/absences";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const employeeUuid = (id: string) => requiredUuid("Funcionário inválido.").parse(id);
const absenceUuid = (id: string) => requiredUuid("Afastamento inválido.").parse(id);

/** Afastamento administrativo com a avaliação derivada (retorno NR-7 7.5.9, sinalização 7.5.19.5 c). */
function withAssessment(row: repo.AbsenceRow, returnExamDates: string[], today: string) {
  return {
    ...row,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    assessment: assessAbsence(row, returnExamDates, today),
  };
}

export type AbsenceView = ReturnType<typeof withAssessment>;

export async function listAbsences(ctx: TenantContext, employeeId: string) {
  const { rows, returnExamDates } = await repo.listEmployeeAbsences(
    ctx,
    employeeUuid(employeeId),
  );
  const today = todayInSaoPaulo();
  return rows.map((row) => withAssessment(row, returnExamDates, today));
}

export async function getAbsence(ctx: TenantContext, id: string) {
  const data = await repo.getEmployeeAbsence(ctx, absenceUuid(id));
  return {
    ...withAssessment(data.absence, data.returnExamDates, todayInSaoPaulo()),
    events: data.events,
  };
}

export async function createAbsence(
  ctx: TenantContext,
  employeeId: string,
  input: unknown,
) {
  const employee = employeeUuid(employeeId);
  const body = input && typeof input === "object" ? input : {};
  const values = absenceInputSchema.parse({ ...body, employeeId: employee });
  const row = await repo.createEmployeeAbsence(ctx, values);
  return withAssessment(row, [], todayInSaoPaulo());
}

export async function updateAbsenceEnd(ctx: TenantContext, id: string, input: unknown) {
  const absence = absenceUuid(id);
  const { endsOn } = absenceEndSchema.parse(input);
  await repo.updateAbsenceEnd(ctx, absence, endsOn);
  return getAbsence(ctx, absence);
}

export async function confirmReturn(ctx: TenantContext, id: string, input: unknown) {
  const absence = absenceUuid(id);
  const { returnedOn } = absenceReturnSchema.parse(input);
  await repo.confirmAbsenceReturn(ctx, absence, returnedOn);
  return getAbsence(ctx, absence);
}

export async function cancelAbsence(ctx: TenantContext, id: string, input: unknown) {
  const absence = absenceUuid(id);
  const { reason } = absenceCancelSchema.parse(input);
  await repo.cancelEmployeeAbsence(ctx, absence, reason);
  return getAbsence(ctx, absence);
}

/** Área clínica (atestado e CID): só o coordenador vinculado; leitura auditada. */
export function readClinicalNotes(ctx: TenantContext, id: string) {
  return repo.readAbsenceClinicalNotes(ctx, absenceUuid(id));
}

export async function addClinicalNote(ctx: TenantContext, id: string, input: unknown) {
  const absence = absenceUuid(id);
  return repo.addAbsenceClinicalNote(
    ctx,
    absence,
    absenceClinicalNoteSchema.parse(input),
  );
}

export function canAccessClinical(ctx: TenantContext, id: string) {
  return repo.canAccessAbsenceClinical(ctx, absenceUuid(id));
}
