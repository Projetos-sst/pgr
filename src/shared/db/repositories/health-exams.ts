import "server-only";

import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import {
  EMPLOYEE_CHANGE_MESSAGE,
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  type ExamType,
  type HealthExamListItem,
  type HealthExamValues,
} from "@/shared/domains/pgr/health-exams";
import type { LatestExam } from "@/shared/domains/medicine/employees";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { asoExaminerConclusions } from "../schema/aso-documents";
import { healthExams, type HealthExamRecord } from "../schema/health-exams";
import { employees } from "../schema/employees";
import { medicos } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";
import { hasAsoDocumentsTx } from "./aso";
import { isClinicalHistoryFkViolation } from "./clinical-records";
import { assertCompanyModuleTx } from "./company-modules";

export const EXAM_DOCTOR_NOT_PHYSICIAN_MESSAGE =
  "O médico responsável pelo exame precisa ser médico (CRM). Psicólogos e outros profissionais não podem ser o responsável pelo exame ocupacional.";

// A FK (employee/medico) é por PK global e o check de FK do Postgres ignora RLS —
// então validamos na aplicação que o funcionário e o médico pertencem AO TENANT.
// Referência inexistente/cross-tenant → FK_NOT_FOUND (espelho de action-plans).
async function assertRefsInTenant(
  tx: Parameters<Parameters<typeof withOrg>[1]>[0],
  orgId: string,
  input: HealthExamValues,
): Promise<{ companyId: string }> {
  const [emp] = await tx
    .select({ id: employees.id, companyId: employees.companyId })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, input.employeeId)))
    .limit(1);
  if (!emp)
    throw new ReferenceNotFoundError("Funcionário não encontrado neste escritório.");
  await assertCompanyModuleTx(tx, orgId, emp.companyId, "medicine");

  if (input.doctorId) {
    const [doc] = await tx
      .select({ id: medicos.id, profession: medicos.profession })
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), eq(medicos.id, input.doctorId)))
      .limit(1);
    if (!doc) throw new ReferenceNotFoundError("Médico não encontrado neste escritório.");
    // O responsável pelo exame ocupacional é médico (CRM): psicólogo não entra aqui (MED-01).
    if (doc.profession !== "physician")
      throw new ValidationError(EXAM_DOCTOR_NOT_PHYSICIAN_MESSAGE);
  }
  return { companyId: emp.companyId };
}

/**
 * Colunas que a aplicação lê do exame. A coluna desativada `notes` (NOB-155) fica de fora: as
 * observações clínicas vivem no prontuário segregado.
 */
const examColumns = {
  id: healthExams.id,
  orgId: healthExams.orgId,
  employeeId: healthExams.employeeId,
  companyId: healthExams.companyId,
  companyOrigin: healthExams.companyOrigin,
  companyOriginConfirmedBy: healthExams.companyOriginConfirmedBy,
  companyOriginConfirmedAt: healthExams.companyOriginConfirmedAt,
  companyOriginNote: healthExams.companyOriginNote,
  doctorId: healthExams.doctorId,
  examType: healthExams.examType,
  performedAt: healthExams.performedAt,
  validUntil: healthExams.validUntil,
  aptitude: healthExams.aptitude,
  certificatePath: healthExams.certificatePath,
  createdAt: healthExams.createdAt,
  updatedAt: healthExams.updatedAt,
} satisfies Record<keyof HealthExamRecord, unknown>;

export const EXAM_WITH_CLINICAL_HISTORY_MESSAGE =
  "Exame com prontuário clínico ou comunicação de restrição registrados não pode ser excluído: o histórico médico é preservado.";

export const EXAM_WITH_ASO_MESSAGE =
  "Exame com prévia de ASO arquivada não pode ser excluído: o histórico do ASO é preservado.";

export const EXAMINER_REQUIRED_MESSAGE =
  "O exame já tem prévia de ASO, ASO assinado ou confirmação do médico examinador: o médico responsável não pode ser removido. Para corrigir, escolha o médico certo.";

/** Exame com prévia ou ASO assinado arquivado, ou com confirmação do examinador registrada. */
async function hasExaminerRecordsTx(
  tx: TenantTransaction,
  orgId: string,
  examId: string,
): Promise<boolean> {
  if (await hasAsoDocumentsTx(tx, orgId, { examId })) return true;
  const rows = await tx
    .select({ id: asoExaminerConclusions.id })
    .from(asoExaminerConclusions)
    .where(
      and(
        eq(asoExaminerConclusions.orgId, orgId),
        eq(asoExaminerConclusions.healthExamId, examId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type ListHealthExamsParams = PageParams & {
  search?: string;
  examType?: ExamType;
  employeeId?: string;
  /**
   * Empresa ATUAL do funcionário (`employees.company_id`). A empresa onde o exame foi realizado
   * (`health_exams.company_id`, MED-07) é usada pelo ASO.
   */
  companyId?: string;
};

export async function listHealthExams(
  orgId: string,
  params: ListHealthExamsParams = {},
): Promise<Paginated<HealthExamListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(healthExams.orgId, orgId)];
  if (search) {
    // "Buscar por funcionário ou exame": nome do funcionário OU rótulo do tipo de
    // exame (ex.: "periódico" → exames periodic). Sem PII adicional exposta.
    const term = `%${search}%`;
    const needle = search.toLowerCase();
    const matchedTypes = EXAM_TYPES.filter((t) =>
      EXAM_TYPE_LABELS[t].toLowerCase().includes(needle),
    );
    filters.push(
      matchedTypes.length > 0
        ? or(
            ilike(employees.fullName, term),
            inArray(healthExams.examType, [...matchedTypes]),
          )!
        : ilike(employees.fullName, term),
    );
  }
  if (params.examType) filters.push(eq(healthExams.examType, params.examType));
  // Filtros SOMADOS a org_id: ID de outro tenant → lista vazia, nunca vazamento.
  // O innerJoin(employees) da lista e da contagem serve ao filtro por empresa.
  if (params.employeeId) filters.push(eq(healthExams.employeeId, params.employeeId));
  if (params.companyId) filters.push(eq(employees.companyId, params.companyId));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: healthExams.id,
        employeeId: healthExams.employeeId,
        employeeName: employees.fullName,
        doctorId: healthExams.doctorId,
        doctorName: medicos.name,
        examType: healthExams.examType,
        performedAt: healthExams.performedAt,
        validUntil: healthExams.validUntil,
        aptitude: healthExams.aptitude,
      })
      .from(healthExams)
      .innerJoin(employees, eq(employees.id, healthExams.employeeId))
      .leftJoin(medicos, eq(medicos.id, healthExams.doctorId))
      .where(where)
      .orderBy(desc(healthExams.performedAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(healthExams)
      .innerJoin(employees, eq(employees.id, healthExams.employeeId))
      .where(where);
    return { rows, total };
  });
}

/**
 * Exame mais recente de cada funcionário (`DISTINCT ON`, sem N+1), com desempate
 * determinístico por `created_at`. Só os campos de `LatestExam` — sem `notes` nem
 * `certificatePath`. A RLS RESTRICTIVE `health_exams_module_access` já esconde
 * exames de empresas sem Medicina.
 */
export async function listLatestHealthExamsByEmployee(
  orgId: string,
  employeeIds: readonly string[],
): Promise<Array<{ employeeId: string } & LatestExam>> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return [];
  return withOrg(orgId, (tx) =>
    tx
      .selectDistinctOn([healthExams.employeeId], {
        employeeId: healthExams.employeeId,
        examType: healthExams.examType,
        performedAt: healthExams.performedAt,
        validUntil: healthExams.validUntil,
        aptitude: healthExams.aptitude,
      })
      .from(healthExams)
      .where(and(eq(healthExams.orgId, orgId), inArray(healthExams.employeeId, ids)))
      .orderBy(
        healthExams.employeeId,
        desc(healthExams.performedAt),
        desc(healthExams.createdAt),
      ),
  );
}

export async function getHealthExamById(
  orgId: string,
  id: string,
): Promise<HealthExamRecord | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select(examColumns)
      .from(healthExams)
      .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createHealthExam(
  orgId: string,
  input: HealthExamValues,
): Promise<HealthExamRecord> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      // Empresa do exame = vínculo atual do funcionário no servidor (MED-07), nunca do cliente.
      const { companyId } = await assertRefsInTenant(tx, orgId, input);
      const [row] = await tx
        .insert(healthExams)
        .values({
          orgId,
          companyId,
          companyOrigin: "registered",
          employeeId: input.employeeId,
          doctorId: input.doctorId ?? null,
          examType: input.examType,
          performedAt: input.performedAt,
          validUntil: input.validUntil ?? null,
          aptitude: input.aptitude,
          certificatePath: input.certificatePath ?? null,
        })
        .returning(examColumns);
      return row;
    }),
  );
}

export async function updateHealthExam(
  orgId: string,
  id: string,
  input: HealthExamValues,
): Promise<HealthExamRecord | null> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      // Identidade do exame: o funcionário não muda na edição. Lê o exame (org +
      // RLS: empresa sem Medicina → invisível → NOT_FOUND) antes de olhar o
      // funcionário pedido, para não revelar nada sobre ele.
      const [current] = await tx
        .select({ employeeId: healthExams.employeeId, doctorId: healthExams.doctorId })
        .from(healthExams)
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
        .limit(1)
        .for("update");
      if (!current) return null;
      if (current.employeeId !== input.employeeId) {
        throw new ValidationError(EMPLOYEE_CHANGE_MESSAGE);
      }
      // Apagar o examinador de exame com prévia, ASO assinado ou confirmação do examinador
      // desfaz a autoria do que já foi documentado. Trocar por outro médico continua permitido.
      if (
        current.doctorId &&
        !input.doctorId &&
        (await hasExaminerRecordsTx(tx, orgId, id))
      )
        throw new ValidationError(EXAMINER_REQUIRED_MESSAGE);
      await assertRefsInTenant(tx, orgId, input);
      const [row] = await tx
        .update(healthExams)
        .set({
          doctorId: input.doctorId ?? null,
          examType: input.examType,
          performedAt: input.performedAt,
          validUntil: input.validUntil ?? null,
          aptitude: input.aptitude,
          certificatePath: input.certificatePath ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(healthExams.orgId, orgId),
            eq(healthExams.id, id),
            eq(healthExams.employeeId, current.employeeId),
          ),
        )
        .returning(examColumns);
      return row ?? null;
    }),
  );
}

export async function deleteHealthExam(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", async () => {
    try {
      return await withOrg(orgId, async (tx) => {
        if (await hasAsoDocumentsTx(tx, orgId, { examId: id }))
          throw new EntityInUseError(EXAM_WITH_ASO_MESSAGE);
        const rows = await tx
          .delete(healthExams)
          .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
          .returning({ id: healthExams.id });
        return rows.length > 0;
      });
    } catch (error) {
      // O RH não lê o prontuário (RLS): a FK RESTRICT do banco é quem barra a exclusão.
      if (isClinicalHistoryFkViolation(error))
        throw new EntityInUseError(EXAM_WITH_CLINICAL_HISTORY_MESSAGE);
      throw error;
    }
  });
}
