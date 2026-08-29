import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type { CompanyValues, CompanyListItem } from "@/shared/domains/pgr/companies";
import { toCompanyListItem } from "@/shared/domains/pgr/companies";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { companies, type Company } from "../schema";
import { workUnits } from "../schema/work-units";
import { ges } from "../schema/ges";
import { jobRoles } from "../schema/job-roles";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

export type ListCompaniesParams = PageParams & { search?: string };

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
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(companies.razaoSocial, term), ilike(companies.cnpj, term))!);
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(companies)
      .where(where)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(where);
    return { rows: rows.map(toCompanyListItem), total };
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

export async function listCompanyOptions(orgId: string): Promise<CompanyOption[]> {
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
      .where(eq(companies.orgId, orgId))
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
