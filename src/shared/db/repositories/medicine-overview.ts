import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { MedicineOverviewData } from "@/shared/domains/medicine/overview";

import { withOrg } from "../with-org";
import { companies } from "../schema/companies";
import { employees } from "../schema/employees";
import { healthExams } from "../schema/health-exams";
import { companyModuleScope } from "../schema/module-policy";

/**
 * Dados do painel da Medicina numa única transação `withOrg` (fotografia
 * consistente), três consultas. O predicado de módulo `medicine` vale para
 * `companies` E para `employees` — `employees` NÃO tem policy de módulo, então sem
 * ele uma empresa sem Medicina vazaria funcionários. Contagens de funcionários em
 * todos os status (mesma semântica de `listEmployees` sem filtro de status).
 */
export async function getMedicineOverviewData(
  orgId: string,
): Promise<MedicineOverviewData> {
  return withOrg(orgId, async (tx) => {
    const companyRows = await tx
      .select({ id: companies.id, razaoSocial: companies.razaoSocial })
      .from(companies)
      .where(
        and(
          eq(companies.orgId, orgId),
          companyModuleScope(companies.orgId, companies.id, "medicine"),
        ),
      )
      .orderBy(companies.razaoSocial);

    const employeeScope = and(
      eq(employees.orgId, orgId),
      companyModuleScope(employees.orgId, employees.companyId, "medicine"),
    );

    const employeeCounts = await tx
      .select({ companyId: employees.companyId, count: sql<number>`count(*)::int` })
      .from(employees)
      .where(employeeScope)
      .groupBy(employees.companyId);

    // Último exame de cada funcionário (desempate determinístico por created_at).
    // A RLS RESTRICTIVE de health_exams já esconde exames de empresas sem Medicina.
    const latestExams = await tx
      .selectDistinctOn([healthExams.employeeId], {
        companyId: employees.companyId,
        validUntil: healthExams.validUntil,
      })
      .from(healthExams)
      .innerJoin(employees, eq(employees.id, healthExams.employeeId))
      .where(and(eq(healthExams.orgId, orgId), employeeScope))
      .orderBy(
        healthExams.employeeId,
        desc(healthExams.performedAt),
        desc(healthExams.createdAt),
      );

    return { companies: companyRows, employeeCounts, latestExams };
  });
}
