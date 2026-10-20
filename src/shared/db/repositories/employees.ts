import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type { EmployeeValues, EmployeeListItem } from "@/shared/domains/pgr/employees";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { employees, type Employee } from "../schema/employees";
import { companies } from "../schema/companies";
import { ges } from "../schema/ges";
import { jobRoles } from "../schema/job-roles";
import { gesJobRoles } from "../schema/ges-job-roles";
import { auditedTenantWrite } from "./audited-write";
import {
  companyModuleSchema,
  type CompanyModule,
} from "@/shared/domains/platform/company-modules";
import { companyModuleScope } from "../schema/module-policy";

export type ListEmployeesParams = PageParams & {
  module?: CompanyModule;
  companyId?: string;
  status?: string;
  search?: string;
  gesId?: string;
};

function toEmployeeColumns(input: EmployeeValues) {
  return {
    companyId: input.companyId,
    fullName: input.fullName,
    cpf: input.cpf,
    gesId: input.gesId ?? null,
    jobRoleId: input.jobRoleId ?? null,
    birthDate: input.birthDate ?? null,
    sex: input.sex ?? null,
    maritalStatus: input.maritalStatus ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    rg: input.rg ?? null,
    badgeNumber: input.badgeNumber ?? null,
    badgeValidUntil: input.badgeValidUntil ?? null,
    registration: input.registration ?? null,
    bloodType: input.bloodType ?? null,
    admissionDate: input.admissionDate ?? null,
    dismissalDate: input.dismissalDate ?? null,
    zipCode: input.zipCode ?? null,
    street: input.street ?? null,
    number: input.number ?? null,
    complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    photoPath: input.photoPath ?? null,
  };
}

async function assertReferences(
  tx: TenantTransaction,
  orgId: string,
  input: EmployeeValues,
): Promise<void> {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, input.companyId)))
    .limit(1);
  if (!company) throw new ReferenceNotFoundError("company");

  if (input.gesId) {
    const [gesRow] = await tx
      .select({ id: ges.id })
      .from(ges)
      .where(
        and(
          eq(ges.orgId, orgId),
          eq(ges.id, input.gesId),
          eq(ges.companyId, input.companyId),
        ),
      )
      .limit(1);
    if (!gesRow) throw new ReferenceNotFoundError("ges");
  }

  if (input.jobRoleId) {
    if (!input.gesId) throw new ReferenceNotFoundError("job_role");
    const [link] = await tx
      .select({ id: gesJobRoles.id })
      .from(gesJobRoles)
      .where(
        and(
          eq(gesJobRoles.orgId, orgId),
          eq(gesJobRoles.gesId, input.gesId),
          eq(gesJobRoles.jobRoleId, input.jobRoleId),
        ),
      )
      .limit(1);
    if (!link) throw new ReferenceNotFoundError("job_role");
  }
}

export async function listEmployees(
  orgId: string,
  params: ListEmployeesParams = {},
): Promise<Paginated<EmployeeListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(employees.orgId, orgId)];
  const selectedModule = companyModuleSchema.optional().parse(params.module);
  if (selectedModule)
    filters.push(
      companyModuleScope(employees.orgId, employees.companyId, selectedModule),
    );
  if (params.companyId) filters.push(eq(employees.companyId, params.companyId));
  if (params.gesId) filters.push(eq(employees.gesId, params.gesId));
  if (params.status)
    filters.push(eq(employees.status, params.status as Employee["status"]));
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(employees.fullName, term),
        ilike(ges.name, term),
        ilike(jobRoles.title, term),
      )!,
    );
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: employees.id,
        fullName: employees.fullName,
        status: employees.status,
        companyName: companies.razaoSocial,
        gesName: ges.name,
        jobRoleTitle: jobRoles.title,
        // Nº de OS do funcionário — subquery correlacionada QUALIFICADA (nomes com
        // prefixo de tabela; ver lição do #188) escopada ao tenant.
        serviceOrderCount: sql<number>`(
          select count(*)::int from "service_orders"
          where "service_orders"."assigned_employee_id" = "employees"."id"
            and "service_orders"."org_id" = ${orgId}
        )`,
      })
      .from(employees)
      .innerJoin(companies, eq(companies.id, employees.companyId))
      .leftJoin(ges, eq(ges.id, employees.gesId))
      .leftJoin(jobRoles, eq(jobRoles.id, employees.jobRoleId))
      .where(where)
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(employees)
      .leftJoin(ges, eq(ges.id, employees.gesId))
      .leftJoin(jobRoles, eq(jobRoles.id, employees.jobRoleId))
      .where(where);

    return { rows, total };
  });
}

export async function getEmployeeById(
  orgId: string,
  id: string,
): Promise<Employee | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createEmployee(
  orgId: string,
  input: EmployeeValues,
): Promise<Employee> {
  return auditedTenantWrite(orgId, "pgr.employees.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertReferences(tx, orgId, input);
      const [row] = await tx
        .insert(employees)
        .values({
          orgId,
          ...toEmployeeColumns(input),
          ...(input.status ? { status: input.status } : {}),
        })
        .returning();
      return row;
    }),
  );
}

export async function updateEmployee(
  orgId: string,
  id: string,
  input: EmployeeValues,
): Promise<Employee | null> {
  return auditedTenantWrite(orgId, "pgr.employees.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertReferences(tx, orgId, input);
      const [row] = await tx
        .update(employees)
        .set({
          ...toEmployeeColumns(input),
          status: input.status ?? "active",
          updatedAt: new Date(),
        })
        .where(and(eq(employees.orgId, orgId), eq(employees.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteEmployee(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.employees.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(employees)
        .where(and(eq(employees.orgId, orgId), eq(employees.id, id)))
        .returning({ id: employees.id });
      return rows.length > 0;
    }),
  );
}
