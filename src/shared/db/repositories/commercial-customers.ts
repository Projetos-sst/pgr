import "server-only";

import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type {
  CustomerInput,
  CustomerKind,
  CustomerStatus,
  CustomerUpdate,
} from "@/shared/domains/commercial/contract";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { commercialCustomers } from "../schema/commercial";
import { companies } from "../schema/companies";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const customers = commercialCustomers;

const columns = {
  id: customers.id,
  kind: customers.kind,
  companyId: customers.companyId,
  legalName: sql<string>`coalesce(${customers.legalName}, ${companies.razaoSocial})`,
  taxId: sql<string | null>`coalesce(${customers.taxId}, ${companies.cnpj})`,
  billingEmail: customers.billingEmail,
  status: customers.status,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

export type CommercialCustomer = {
  id: string;
  kind: CustomerKind;
  companyId: string | null;
  legalName: string;
  taxId: string | null;
  billingEmail: string;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerFilters = PageParams & {
  kind?: CustomerKind;
  status?: CustomerStatus;
};

const selectCustomers = (tx: TenantTransaction) =>
  tx
    .select(columns)
    .from(customers)
    .leftJoin(
      companies,
      and(eq(companies.id, customers.companyId), eq(companies.orgId, customers.orgId)),
    );

export async function findCustomer(
  tx: TenantTransaction,
  orgId: string,
  id: string,
): Promise<CommercialCustomer | null> {
  const [row] = await selectCustomers(tx).where(
    and(eq(customers.orgId, orgId), eq(customers.id, id)),
  );
  return row ?? null;
}

export async function findOfficeCustomer(
  tx: TenantTransaction,
  orgId: string,
): Promise<CommercialCustomer | null> {
  const [row] = await selectCustomers(tx).where(
    and(eq(customers.orgId, orgId), eq(customers.kind, "office")),
  );
  return row ?? null;
}

async function requireCustomer(tx: TenantTransaction, orgId: string, id: string) {
  const customer = await findCustomer(tx, orgId, id);
  if (!customer) throw new NotFoundError();
  return customer;
}

async function assertCompanyInOrg(tx: TenantTransaction, orgId: string, id: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, id)));
  if (!company) throw new ReferenceNotFoundError("Empresa inexistente neste escritório.");
}

export function createCustomer(
  ctx: TenantContext,
  input: CustomerInput,
): Promise<CommercialCustomer> {
  return auditedTenantWrite(ctx.tenantId, "commercial.customer.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      if (input.kind === "company")
        await assertCompanyInOrg(tx, ctx.tenantId, input.companyId);
      const [created] = await tx
        .insert(customers)
        .values({ ...input, orgId: ctx.tenantId, createdBy: ctx.userId })
        .returning({ id: customers.id });
      return requireCustomer(tx, ctx.tenantId, created.id);
    }),
  );
}

export function listCustomers(
  ctx: TenantContext,
  filters: CustomerFilters = {},
): Promise<Paginated<CommercialCustomer>> {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const conditions: SQL[] = [eq(customers.orgId, ctx.tenantId)];
    if (filters.kind) conditions.push(eq(customers.kind, filters.kind));
    if (filters.status) conditions.push(eq(customers.status, filters.status));
    const where = and(...conditions);
    const rows = await selectCustomers(tx)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(customers).where(where);
    return { rows, total };
  });
}

export function getCustomer(ctx: TenantContext, id: string): Promise<CommercialCustomer> {
  return withOrg(ctx.tenantId, (tx) => requireCustomer(tx, ctx.tenantId, id));
}

export function updateCustomer(
  ctx: TenantContext,
  id: string,
  update: CustomerUpdate,
): Promise<CommercialCustomer> {
  return auditedTenantWrite(ctx.tenantId, "commercial.customer.update", () =>
    withOrg(ctx.tenantId, async (tx) => {
      const current = await requireCustomer(tx, ctx.tenantId, id);
      const changesIdentity =
        update.legalName !== undefined || update.taxId !== undefined;
      if (current.kind === "company" && changesIdentity)
        throw new ValidationError(
          "A identidade do cliente direto vem do cadastro da empresa.",
        );
      await tx
        .update(customers)
        .set(update)
        .where(and(eq(customers.orgId, ctx.tenantId), eq(customers.id, id)));
      return requireCustomer(tx, ctx.tenantId, id);
    }),
  );
}
