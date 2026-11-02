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

import { withOrg } from "../with-org";
import { healthExams, type HealthExam } from "../schema/health-exams";
import { employees } from "../schema/employees";
import { medicos } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";
import { hasAsoDocumentsTx } from "./aso";
import { assertCompanyModuleTx } from "./company-modules";

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
      .select({ id: medicos.id })
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), eq(medicos.id, input.doctorId)))
      .limit(1);
    if (!doc) throw new ReferenceNotFoundError("Médico não encontrado neste escritório.");
  }
  return { companyId: emp.companyId };
}

export const EXAM_WITH_ASO_MESSAGE =
  "Exame com prévia de ASO arquivada não pode ser excluído: o histórico do ASO é preservado.";

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
): Promise<HealthExam | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(healthExams)
      .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createHealthExam(
  orgId: string,
  input: HealthExamValues,
): Promise<HealthExam> {
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
          notes: input.notes ?? null,
          certificatePath: input.certificatePath ?? null,
        })
        .returning();
      return row;
    }),
  );
}

export async function updateHealthExam(
  orgId: string,
  id: string,
  input: HealthExamValues,
): Promise<HealthExam | null> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      // Identidade do exame: o funcionário não muda na edição. Lê o exame (org +
      // RLS: empresa sem Medicina → invisível → NOT_FOUND) antes de olhar o
      // funcionário pedido, para não revelar nada sobre ele.
      const [current] = await tx
        .select({ employeeId: healthExams.employeeId })
        .from(healthExams)
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
        .limit(1)
        .for("update");
      if (!current) return null;
      if (current.employeeId !== input.employeeId) {
        throw new ValidationError(EMPLOYEE_CHANGE_MESSAGE);
      }
      await assertRefsInTenant(tx, orgId, input);
      const [row] = await tx
        .update(healthExams)
        .set({
          doctorId: input.doctorId ?? null,
          examType: input.examType,
          performedAt: input.performedAt,
          validUntil: input.validUntil ?? null,
          aptitude: input.aptitude,
          notes: input.notes ?? null,
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
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteHealthExam(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      if (await hasAsoDocumentsTx(tx, orgId, { examId: id }))
        throw new EntityInUseError(EXAM_WITH_ASO_MESSAGE);
      const rows = await tx
        .delete(healthExams)
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
        .returning({ id: healthExams.id });
      return rows.length > 0;
    }),
  );
}
