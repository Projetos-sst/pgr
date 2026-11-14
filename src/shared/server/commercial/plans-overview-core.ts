import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import { listCompanyOptions } from "@/shared/db/repositories/companies";
import type {
  BillingPeriod,
  CommercialService,
  CommercialUnit,
  OfferQuota,
  OfferScope,
} from "@/shared/domains/commercial/offer";
import {
  paymentState,
  READ_ONLY_MESSAGE,
  type PaymentState,
} from "@/shared/domains/commercial/plans-overview";

import { getContractBilling } from "./billing-events-core";
import {
  getContract,
  listCompanyTrials,
  listContracts,
  listCustomers,
  listSellableOffers,
} from "./commercial-core";

const OVERVIEW_PAGE_SIZE = 100;

export type OverviewOffer = {
  id: string;
  code: string;
  version: number;
  name: string;
  description: string;
  scope: OfferScope;
  billingPeriod: BillingPeriod;
  quotas: OfferQuota[];
  fictitious: boolean;
  items: {
    service: CommercialService;
    label: string;
    unit: CommercialUnit;
    unitAmountCents: number;
  }[];
};

export type PlansOverview = {
  canContract: boolean;
  readOnlyMessage: string | null;
  termStart: string;
  offers: OverviewOffer[];
  trials: { companyId: string; status: string; endsAt: string }[];
  customers: {
    id: string;
    kind: "office" | "company";
    companyId: string | null;
    legalName: string;
  }[];
  companies: { id: string; name: string }[];
  contracts: {
    id: string;
    offerVersionId: string;
    offerCode: string;
    offerName: string;
    customerId: string;
    companyIds: string[];
    termStart: string;
    payment: PaymentState;
  }[];
};

async function loadOffers(ctx: TenantContext): Promise<OverviewOffer[]> {
  const offers = await listSellableOffers(ctx);
  return offers.map((offer) => ({
    id: offer.id,
    code: offer.code,
    version: offer.version,
    name: offer.name,
    description: offer.description,
    scope: offer.scope,
    billingPeriod: offer.billingPeriod,
    quotas: offer.quotas,
    fictitious: offer.fictitious,
    items: offer.items,
  }));
}

async function loadTrials(ctx: TenantContext): Promise<PlansOverview["trials"]> {
  const { rows } = await listCompanyTrials(ctx, { pageSize: OVERVIEW_PAGE_SIZE });
  return rows.map((trial) => ({
    companyId: trial.companyId,
    status: trial.status,
    endsAt: trial.endsAt.toISOString(),
  }));
}

async function loadContracts(ctx: TenantContext): Promise<PlansOverview["contracts"]> {
  const { rows } = await listContracts(ctx, { pageSize: OVERVIEW_PAGE_SIZE });
  return Promise.all(
    rows.map(async (contract) => {
      const detail = await getContract(ctx, contract.id);
      const billing = await getContractBilling(ctx, contract.id);
      return {
        id: contract.id,
        offerVersionId: contract.offerVersionId,
        offerCode: contract.offerCode,
        offerName: contract.offerName,
        customerId: contract.customerId,
        companyIds: detail.companyIds,
        termStart: contract.termStart,
        payment: paymentState(billing),
      };
    }),
  );
}

async function loadOwnerData(ctx: TenantContext) {
  const customers = await listCustomers(ctx, {
    pageSize: OVERVIEW_PAGE_SIZE,
    status: "active",
  });
  return {
    customers: customers.rows.map((customer) => ({
      id: customer.id,
      kind: customer.kind,
      companyId: customer.companyId,
      legalName: customer.legalName,
    })),
    contracts: await loadContracts(ctx),
  };
}

async function loadCompanies(ctx: TenantContext): Promise<PlansOverview["companies"]> {
  const companies = await listCompanyOptions(ctx.tenantId);
  return companies.map((company) => ({ id: company.id, name: company.razaoSocial }));
}

export async function getPlansOverview(ctx: TenantContext): Promise<PlansOverview> {
  const offers = await loadOffers(ctx);
  const trials = await loadTrials(ctx);
  const companies = await loadCompanies(ctx);
  const base = { termStart: todayInSaoPaulo(), offers, trials, companies };
  if (ctx.role !== "owner")
    return {
      ...base,
      canContract: false,
      readOnlyMessage: READ_ONLY_MESSAGE,
      customers: [],
      contracts: [],
    };
  const ownerData = await loadOwnerData(ctx);
  return { ...base, canContract: true, readOnlyMessage: null, ...ownerData };
}
