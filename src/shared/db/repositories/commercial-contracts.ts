import "server-only";

import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  contractCompaniesProblem,
  contractSnapshot,
  type ContractInput,
} from "@/shared/domains/commercial/contract";
import {
  sellableOffers,
  type CommercialEnvironment,
} from "@/shared/domains/commercial/offer";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";

import {
  commercialContractCompanies,
  commercialContractItems,
  commercialContracts,
} from "../schema/commercial";
import { companies } from "../schema/companies";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import { listPublishedOffers } from "./commercial-catalog";
import { findCustomer, type CommercialCustomer } from "./commercial-customers";

const contractCompanies = commercialContractCompanies;
const contractItems = commercialContractItems;
const contracts = commercialContracts;

const header = {
  id: contracts.id,
  customerId: contracts.customerId,
  offerVersionId: contracts.offerVersionId,
  customerKind: contracts.customerKind,
  customerLegalName: contracts.customerLegalName,
  customerTaxId: contracts.customerTaxId,
  offerCode: contracts.offerCode,
  offerVersion: contracts.offerVersion,
  offerName: contracts.offerName,
  offerScope: contracts.offerScope,
  currency: contracts.currency,
  billingPeriod: contracts.billingPeriod,
  quotas: contracts.quotas,
  fictitious: contracts.fictitious,
  termStart: contracts.termStart,
  termEnd: contracts.termEnd,
  contractedBy: contracts.contractedBy,
  contractedAt: contracts.contractedAt,
};

export type ContractFilters = PageParams & { customerId?: string };
export type ContractClock = { today: string; env: CommercialEnvironment };

async function loadContract(tx: TenantTransaction, orgId: string, id: string) {
  const [row] = await tx
    .select(header)
    .from(contracts)
    .where(and(eq(contracts.orgId, orgId), eq(contracts.id, id)));
  if (!row) throw new NotFoundError();
  const items = await tx
    .select({
      position: contractItems.position,
      service: contractItems.service,
      label: contractItems.label,
      unit: contractItems.unit,
      unitAmountCents: contractItems.unitAmountCents,
    })
    .from(contractItems)
    .where(and(eq(contractItems.orgId, orgId), eq(contractItems.contractId, id)))
    .orderBy(contractItems.position);
  const users = await tx
    .select({ companyId: contractCompanies.companyId })
    .from(contractCompanies)
    .where(and(eq(contractCompanies.orgId, orgId), eq(contractCompanies.contractId, id)))
    .orderBy(contractCompanies.companyId);
  return { ...row, items, companyIds: users.map((user) => user.companyId) };
}
export type CommercialContract = Awaited<ReturnType<typeof loadContract>>;

async function activePayer(tx: TenantTransaction, orgId: string, customerId: string) {
  const customer = await findCustomer(tx, orgId, customerId);
  if (!customer)
    throw new ReferenceNotFoundError("Cliente inexistente neste escritório.");
  if (customer.status !== "active")
    throw new ValidationError("Cliente inativo não faz novas contratações.");
  if (!customer.taxId)
    throw new ValidationError("A empresa pagadora precisa ter CNPJ cadastrado.");
  return { ...customer, taxId: customer.taxId };
}

export async function offerOnSale(
  tx: TenantTransaction,
  id: string,
  clock: ContractClock,
) {
  const onSale = sellableOffers(await listPublishedOffers(tx), clock.today, clock.env);
  const offer = onSale.find((candidate) => candidate.id === id);
  if (!offer)
    throw new ValidationError(
      "Esta versão de oferta não está à venda. Consulte o catálogo vigente.",
    );
  return offer;
}

async function assertCompaniesInOrg(
  tx: TenantTransaction,
  orgId: string,
  companyIds: readonly string[],
) {
  if (companyIds.length === 0) return;
  const found = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), inArray(companies.id, [...companyIds])));
  if (found.length !== companyIds.length)
    throw new ReferenceNotFoundError("Empresa inexistente neste escritório.");
}

function assertParties(
  customer: CommercialCustomer,
  offerScope: Parameters<typeof contractCompaniesProblem>[0]["offerScope"],
  companyIds: readonly string[],
) {
  const problem = contractCompaniesProblem({
    customerKind: customer.kind,
    customerCompanyId: customer.companyId,
    offerScope,
    companyIds,
  });
  if (problem) throw new ValidationError(problem);
}

export async function createContractIn(
  tx: TenantTransaction,
  ctx: TenantContext,
  input: ContractInput,
  clock: ContractClock,
): Promise<CommercialContract> {
  const customer = await activePayer(tx, ctx.tenantId, input.customerId);
  const offer = await offerOnSale(tx, input.offerVersionId, clock);
  assertParties(customer, offer.scope, input.companyIds);
  await assertCompaniesInOrg(tx, ctx.tenantId, input.companyIds);
  const snapshot = contractSnapshot({
    customer: {
      kind: customer.kind,
      legalName: customer.legalName,
      taxId: customer.taxId,
    },
    offer,
  });
  const [created] = await tx
    .insert(contracts)
    .values({
      ...snapshot.header,
      orgId: ctx.tenantId,
      customerId: customer.id,
      termStart: input.termStart,
      termEnd: input.termEnd,
      contractedBy: ctx.userId,
    })
    .returning({ id: contracts.id });
  const scoped = { orgId: ctx.tenantId, contractId: created.id };
  await tx
    .insert(contractItems)
    .values(snapshot.items.map((item) => ({ ...item, ...scoped })));
  if (input.companyIds.length > 0)
    await tx
      .insert(contractCompanies)
      .values(input.companyIds.map((companyId) => ({ ...scoped, companyId })));
  return loadContract(tx, ctx.tenantId, created.id);
}

export function createContract(
  ctx: TenantContext,
  input: ContractInput,
  clock: ContractClock,
): Promise<CommercialContract> {
  return auditedTenantWrite(ctx.tenantId, "commercial.contract.create", () =>
    withOrg(ctx.tenantId, (tx) => createContractIn(tx, ctx, input, clock)),
  );
}

export function getContract(ctx: TenantContext, id: string): Promise<CommercialContract> {
  return withOrg(ctx.tenantId, (tx) => loadContract(tx, ctx.tenantId, id));
}

export function listContracts(ctx: TenantContext, filters: ContractFilters = {}) {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const conditions: SQL[] = [eq(contracts.orgId, ctx.tenantId)];
    if (filters.customerId) conditions.push(eq(contracts.customerId, filters.customerId));
    const where = and(...conditions);
    const rows = await tx
      .select(header)
      .from(contracts)
      .where(where)
      .orderBy(desc(contracts.seq))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(contracts).where(where);
    return { rows, total };
  });
}
