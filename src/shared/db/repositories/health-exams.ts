import "server-only";

import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type {
  ExamType,
  HealthExamListItem,
  HealthExamValues,
} from "@/shared/domains/pgr/health-exams";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg } from "../with-org";
import { healthExams, type HealthExam } from "../schema/health-exams";
import { employees } from "../schema/employees";
import { medicos } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";

// A FK (employee/medico) é por PK global e o check de FK do Postgres ignora RLS —
// então validamos na aplicação que o funcionário e o médico pertencem AO TENANT.
// Referência inexistente/cross-tenant → FK_NOT_FOUND (espelho de action-plans).
async function assertRefsInTenant(
  tx: Parameters<Parameters<typeof withOrg>[1]>[0],
  orgId: string,
  input: HealthExamValues,
): Promise<void> {
  const [emp] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, input.employeeId)))
    .limit(1);
  if (!emp) throw new ReferenceNotFoundError("employee");

  if (input.doctorId) {
    const [doc] = await tx
      .select({ id: medicos.id })
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), eq(medicos.id, input.doctorId)))
      .limit(1);
    if (!doc) throw new ReferenceNotFoundError("doctor");
  }
}

export type ListHealthExamsParams = PageParams & {
  search?: string;
  examType?: ExamType;
};

export async function listHealthExams(
  orgId: string,
  params: ListHealthExamsParams = {},
): Promise<Paginated<HealthExamListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(healthExams.orgId, orgId)];
  if (search) filters.push(ilike(employees.fullName, `%${search}%`));
  if (params.examType) filters.push(eq(healthExams.examType, params.examType));
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
      await assertRefsInTenant(tx, orgId, input);
      const [row] = await tx
        .insert(healthExams)
        .values({
          orgId,
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
      await assertRefsInTenant(tx, orgId, input);
      const [row] = await tx
        .update(healthExams)
        .set({
          employeeId: input.employeeId,
          doctorId: input.doctorId ?? null,
          examType: input.examType,
          performedAt: input.performedAt,
          validUntil: input.validUntil ?? null,
          aptitude: input.aptitude,
          notes: input.notes ?? null,
          certificatePath: input.certificatePath ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteHealthExam(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.health-exams.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(healthExams)
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.id, id)))
        .returning({ id: healthExams.id });
      return rows.length > 0;
    }),
  );
}
