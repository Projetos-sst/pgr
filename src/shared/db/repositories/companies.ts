import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  CompanyValues,
  CompanyListItem,
  CompanyStatus,
} from "@/shared/domains/pgr/companies";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { companies, type Company } from "../schema";
import { workUnits } from "../schema/work-units";
import { ges } from "../schema/ges";
import { jobRoles } from "../schema/job-roles";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";
import {
  companyModuleSchema,
  type CompanyModule,
} from "@/shared/domains/platform/company-modules";
import { companyModuleScope } from "../schema/module-policy";

export type ListCompaniesParams = PageParams & {
  module?: CompanyModule;
  search?: string;
  state?: string;
  status?: CompanyStatus;
};

export type CompanyDependents = {
  workUnits: number;
  ges: number;
  jobRoles: number;
  employees: number;
};

function toCompanyColumns(input: CompanyValues) {
  return {
    cnpj: input.cnpj ?? null,
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    cnae: input.cnae ?? null,
    mainActivity: input.mainActivity ?? null,
    riskGrade: input.riskGrade,
    logoPath: input.logoPath ?? null,
    website: input.website ?? null,
    status: input.status,
    taxClassification: input.taxClassification ?? null,
    zipCode: input.zipCode ?? null,
    street: input.street ?? null,
    number: input.number ?? null,
    complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
  };
}

export async function listCompanies(
  orgId: string,
  params: ListCompaniesParams = {},
): Promise<Paginated<CompanyListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(companies.orgId, orgId)];
  const selectedModule = companyModuleSchema.optional().parse(params.module);
  if (selectedModule)
    filters.push(companyModuleScope(companies.orgId, companies.id, selectedModule));
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(companies.razaoSocial, term), ilike(companies.cnpj, term))!);
  }
  if (params.state) filters.push(eq(companies.state, params.state));
  if (params.status) filters.push(eq(companies.status, params.status));
  const where = and(...filters);

  // Contagens correlacionadas (Funcion./GES do #188) — derivadas na leitura, sem
  // coluna. Nomes de tabela/coluna são qualificados manualmente: o `sql` do drizzle
  // renderia `${column}` SEM prefixo de tabela, e dentro da subquery `"id"`/`"company_id"`
  // colidiriam com a própria `employees`/`ges` (correlação quebrada → sempre 0).
  const employeeCount = sql<number>`(
    select count(*)::int from "employees"
    where "employees"."company_id" = "companies"."id" and "employees"."org_id" = ${orgId}
  )`;
  const gesCount = sql<number>`(
    select count(*)::int from "ges"
    where "ges"."company_id" = "companies"."id" and "ges"."org_id" = ${orgId}
  )`;

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: companies.id,
        razaoSocial: companies.razaoSocial,
        pgrEnabled: companyModuleScope(companies.orgId, companies.id, "pgr"),
        medicineEnabled: companyModuleScope(companies.orgId, companies.id, "medicine"),
        cnpj: companies.cnpj,
        city: companies.city,
        state: companies.state,
        status: companies.status,
        employeeCount,
        gesCount,
      })
      .from(companies)
      .where(where)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(where);
    return { rows, total };
  });
}

export type CompanyOption = {
  id: string;
  razaoSocial: string;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

export async function listCompanyOptions(
  orgId: string,
  requestedModule?: CompanyModule,
): Promise<CompanyOption[]> {
  const selectedModule = companyModuleSchema.optional().parse(requestedModule);
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: companies.id,
        razaoSocial: companies.razaoSocial,
        zipCode: companies.zipCode,
        street: companies.street,
        number: companies.number,
        complement: companies.complement,
        district: companies.district,
        city: companies.city,
        state: companies.state,
      })
      .from(companies)
      .where(
        and(
          eq(companies.orgId, orgId),
          selectedModule
            ? companyModuleScope(companies.orgId, companies.id, selectedModule)
            : undefined,
        ),
      )
      .orderBy(companies.razaoSocial),
  );
}

export async function getCompanyById(orgId: string, id: string): Promise<Company | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createCompany(
  orgId: string,
  input: CompanyValues,
): Promise<Company> {
  return auditedTenantWrite(orgId, "pgr.companies.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(companies)
        .values({ orgId, ...toCompanyColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateCompany(
  orgId: string,
  id: string,
  input: CompanyValues,
): Promise<Company | null> {
  return auditedTenantWrite(orgId, "pgr.companies.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(companies)
        .set({ ...toCompanyColumns(input), updatedAt: new Date() })
        .where(and(eq(companies.orgId, orgId), eq(companies.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteCompany(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.companies.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(companies)
        .where(and(eq(companies.orgId, orgId), eq(companies.id, id)))
        .returning({ id: companies.id });
      return rows.length > 0;
    }),
  );
}

export async function countCompanyDependents(
  orgId: string,
  id: string,
): Promise<CompanyDependents> {
  return withOrg(orgId, async (tx) => {
    const countFor = async (
      table: typeof workUnits | typeof ges | typeof jobRoles | typeof employees,
    ): Promise<number> => {
      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(table)
        .where(and(eq(table.orgId, orgId), eq(table.companyId, id)));
      return total;
    };
    return {
      workUnits: await countFor(workUnits),
      ges: await countFor(ges),
      jobRoles: await countFor(jobRoles),
      employees: await countFor(employees),
    };
  });
}
