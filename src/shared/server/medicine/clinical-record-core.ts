import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import * as repo from "@/shared/db/repositories/clinical-records";
import {
  clinicalNoteInputSchema,
  workRestrictionInputSchema,
} from "@/shared/domains/medicine/clinical-record";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const examUuid = (id: string) => requiredUuid("Exame inválido.").parse(id);

/**
 * Prontuário segregado do exame (NOB-155, DT-21). A autorização é por vínculo (examinador ou
 * coordenador), no repositório e nas policies da 0067; o papel no escritório não basta.
 */
export function getClinicalAccess(ctx: TenantContext, examId: string) {
  return repo.getClinicalAccess(ctx, examUuid(examId));
}

export function readClinicalRecord(ctx: TenantContext, examId: string) {
  return repo.readClinicalRecord(ctx, examUuid(examId));
}

export async function addClinicalNote(
  ctx: TenantContext,
  examId: string,
  input: unknown,
) {
  const id = examUuid(examId);
  const { content } = clinicalNoteInputSchema.parse(input);
  return repo.addClinicalNote(ctx, id, content);
}

/** Comunicação de restrição ao trabalho: o RH (owner, colaborador) lê; só o médico grava. */
export function listWorkRestrictions(ctx: TenantContext, examId: string) {
  return repo.listWorkRestrictions(ctx, examUuid(examId));
}

export async function recordWorkRestriction(
  ctx: TenantContext,
  examId: string,
  input: unknown,
) {
  const id = examUuid(examId);
  return repo.recordWorkRestriction(ctx, id, workRestrictionInputSchema.parse(input));
}

/** Trilha de acesso ao prontuário: só o owner do escritório consulta (sem conteúdo clínico). */
export async function listClinicalAccessEvents(ctx: TenantContext, examId: string) {
  const id = examUuid(examId);
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o responsável pelo escritório consulta a trilha de acesso ao prontuário.",
    );
  return repo.listClinicalAccessEvents(ctx, id);
}
