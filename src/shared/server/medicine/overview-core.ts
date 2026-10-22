import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  medicineEmployeesQuerySchema,
  type MedicineEmployeeItem,
} from "@/shared/domains/medicine/employees";
import {
  summarizeMedicineOverview,
  type MedicineOverview,
} from "@/shared/domains/medicine/overview";
import { EXAM_DUE_WINDOW_DAYS } from "@/shared/domains/pgr/health-exams";
import * as companyModulesRepo from "@/shared/db/repositories/company-modules";
import * as employeesRepo from "@/shared/db/repositories/employees";
import * as healthExamsRepo from "@/shared/db/repositories/health-exams";
import * as overviewRepo from "@/shared/db/repositories/medicine-overview";
import type { Paginated } from "@/shared/pagination";

// Núcleo do painel da Medicina, compartilhado pela Server Action e pelo REST mirror
// (padrão de `platform/company-module-core.ts`). Tenant sempre de `ctx.tenantId`.

export async function getMedicineOverview(ctx: TenantContext): Promise<MedicineOverview> {
  const data = await overviewRepo.getMedicineOverviewData(ctx.tenantId);
  return summarizeMedicineOverview(data, {
    today: todayInSaoPaulo(),
    dueWindowDays: EXAM_DUE_WINDOW_DAYS,
  });
}

/**
 * Funcionários de UMA empresa com o exame mais recente de cada um. `companyId`
 * ausente/malformado → `VALIDATION`; empresa fora do tenant → `NOT_FOUND`
 * (`getCompanyModules`); empresa sem Medicina → `FORBIDDEN` explícito (não lista
 * vazia). A lista ainda passa `module: "medicine"` porque `employees` não tem policy
 * de módulo. Saída sem CPF, sem `notes`, sem nome da empresa.
 */
export async function listMedicineEmployees(
  ctx: TenantContext,
  input: unknown,
): Promise<Paginated<MedicineEmployeeItem>> {
  const query = medicineEmployeesQuerySchema.parse(input);
  const modules = await companyModulesRepo.getCompanyModules(
    ctx.tenantId,
    query.companyId,
  );
  if (!modules.some((m) => m.module === "medicine" && m.enabled))
    throw new ForbiddenError("Serviço não habilitado para esta empresa.");

  const page = await employeesRepo.listEmployees(ctx.tenantId, {
    module: "medicine",
    companyId: query.companyId,
    search: query.search,
    page: query.page,
    pageSize: query.pageSize,
  });
  const latest = await healthExamsRepo.listLatestHealthExamsByEmployee(
    ctx.tenantId,
    page.rows.map((row) => row.id),
  );
  const latestByEmployee = new Map(latest.map((exam) => [exam.employeeId, exam]));

  return {
    total: page.total,
    rows: page.rows.map((row) => {
      const exam = latestByEmployee.get(row.id);
      return {
        id: row.id,
        fullName: row.fullName,
        status: row.status,
        jobRoleTitle: row.jobRoleTitle,
        gesName: row.gesName,
        latestExam: exam
          ? {
              examType: exam.examType,
              performedAt: exam.performedAt,
              validUntil: exam.validUntil,
              aptitude: exam.aptitude,
            }
          : null,
      };
    }),
  };
}
