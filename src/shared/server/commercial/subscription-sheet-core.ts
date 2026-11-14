import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { listCompanyOptions } from "@/shared/db/repositories/companies";
import { findPayerProviderCustomerId } from "@/shared/db/repositories/billing-portal";
import type {
  CheckoutStatus,
  SubscriptionStatus,
} from "@/shared/domains/commercial/billing-model";
import type {
  BillingPeriod,
  CommercialService,
  CommercialUnit,
} from "@/shared/domains/commercial/offer";
import {
  availableActions,
  contractAccessState,
  rightAccessState,
  subscriptionAccessAt,
  type AccessState,
  type SheetAction,
} from "@/shared/domains/commercial/subscription-sheet";

import { getContractBilling } from "./billing-events-core";
import {
  getContract,
  listCompanyTrials,
  listContracts,
  requireFinancialOwner,
} from "./commercial-core";
import { isPaymentAvailable } from "./portal-session-core";

const SHEET_PAGE_SIZE = 100;

export type SheetTrial = {
  companyId: string;
  companyName: string;
  status: string;
  endsAt: string;
};

export type SheetRight = {
  companyId: string | null;
  service: string;
  state: AccessState;
};

export type SheetContract = {
  id: string;
  offerCode: string;
  offerName: string;
  billingPeriod: BillingPeriod;
  currency: string;
  fictitious: boolean;
  customerLegalName: string;
  termStart: string;
  items: {
    position: number;
    service: CommercialService;
    label: string;
    unit: CommercialUnit;
    unitAmountCents: number;
  }[];
  companies: { id: string; name: string }[];
  trials: SheetTrial[];
  financial: {
    status: SubscriptionStatus | null;
    checkoutStatus: CheckoutStatus | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  };
  access: { state: AccessState; keptUntil: string | null; rights: SheetRight[] };
  availableActions: SheetAction[];
};

export type SubscriptionSheet = { contracts: SheetContract[] };

type CompanyName = { id: string; name: string };
type Billing = Awaited<ReturnType<typeof getContractBilling>>;

const isoOrNull = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

function financialOf(billing: Billing): SheetContract["financial"] {
  const subscription = billing.subscription;
  return {
    status: subscription?.status ?? null,
    checkoutStatus: billing.checkout?.status ?? null,
    currentPeriodStart: isoOrNull(subscription?.currentPeriodStart),
    currentPeriodEnd: isoOrNull(subscription?.currentPeriodEnd),
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    canceledAt: isoOrNull(subscription?.canceledAt),
  };
}

function accessOf(billing: Billing, now: Date): SheetContract["access"] {
  const scheduled = billing.subscription
    ? subscriptionAccessAt(billing.subscription, now)
    : null;
  return {
    state: contractAccessState(billing.entitlements),
    keptUntil: isoOrNull(scheduled?.until),
    rights: billing.entitlements.map((right) => ({
      companyId: right.companyId,
      service: right.service,
      state: rightAccessState(right),
    })),
  };
}

async function actionsOf(
  ctx: TenantContext,
  contractId: string,
  billing: Billing,
): Promise<SheetAction[]> {
  const providerCustomerId = await findPayerProviderCustomerId(ctx, contractId);
  return availableActions({
    paymentAvailable: isPaymentAvailable(),
    hasProviderCustomer: providerCustomerId !== null,
    hasOpenCheckout: billing.checkout?.status === "open",
  });
}

async function loadSheetContract(
  ctx: TenantContext,
  contractId: string,
  companies: CompanyName[],
  trials: SheetTrial[],
): Promise<SheetContract> {
  const detail = await getContract(ctx, contractId);
  const billing = await getContractBilling(ctx, contractId);
  return {
    id: detail.id,
    offerCode: detail.offerCode,
    offerName: detail.offerName,
    billingPeriod: detail.billingPeriod,
    currency: detail.currency,
    fictitious: detail.fictitious,
    customerLegalName: detail.customerLegalName,
    termStart: detail.termStart,
    items: detail.items,
    companies: companies.filter((company) => detail.companyIds.includes(company.id)),
    trials: trials.filter((trial) => detail.companyIds.includes(trial.companyId)),
    financial: financialOf(billing),
    access: accessOf(billing, new Date()),
    availableActions: await actionsOf(ctx, contractId, billing),
  };
}

async function loadTrials(
  ctx: TenantContext,
  companies: CompanyName[],
): Promise<SheetTrial[]> {
  const { rows } = await listCompanyTrials(ctx, { pageSize: SHEET_PAGE_SIZE });
  return rows.map((trial) => ({
    companyId: trial.companyId,
    companyName: companies.find((company) => company.id === trial.companyId)?.name ?? "",
    status: trial.status,
    endsAt: trial.endsAt.toISOString(),
  }));
}

export async function getSubscriptionSheet(
  ctx: TenantContext,
): Promise<SubscriptionSheet> {
  requireFinancialOwner(ctx);
  const { rows } = await listContracts(ctx, { pageSize: SHEET_PAGE_SIZE });
  const options = await listCompanyOptions(ctx.tenantId);
  const companies = options.map((company) => ({
    id: company.id,
    name: company.razaoSocial,
  }));
  const trials = await loadTrials(ctx, companies);
  const contracts = await Promise.all(
    rows.map((row) => loadSheetContract(ctx, row.id, companies, trials)),
  );
  return { contracts };
}
