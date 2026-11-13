import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  BILLING_PROVIDER,
  type EntitlementTarget,
} from "@/shared/domains/commercial/billing-model";
import { DuplicateError } from "@/shared/errors/duplicate-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import {
  billingCheckoutSessions,
  billingProviderCustomers,
  billingProviderPrices,
  billingSubscriptions,
} from "../schema/billing";
import {
  commercialContractCompanies,
  commercialContractItems,
  commercialContracts,
  commercialCustomers,
  commercialOfferItems,
} from "../schema/commercial";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const sessions = billingCheckoutSessions;
const contracts = commercialContracts;

const columns = {
  id: sessions.id,
  contractId: sessions.contractId,
  status: sessions.status,
  url: sessions.url,
  expiresAt: sessions.expiresAt,
  createdAt: sessions.createdAt,
  completedAt: sessions.completedAt,
};

async function findByKey(tx: TenantTransaction, orgId: string, idempotencyKey: string) {
  const [session] = await tx
    .select(columns)
    .from(sessions)
    .where(and(eq(sessions.orgId, orgId), eq(sessions.idempotencyKey, idempotencyKey)));
  return session ?? null;
}
export type CheckoutSession = NonNullable<Awaited<ReturnType<typeof findByKey>>>;

async function assertNoOtherCheckout(
  tx: TenantTransaction,
  orgId: string,
  contractId: string,
) {
  const [subscription] = await tx
    .select({ id: billingSubscriptions.id })
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.orgId, orgId),
        eq(billingSubscriptions.contractId, contractId),
      ),
    );
  if (subscription)
    throw new DuplicateError("Esta contratação já tem assinatura no provedor.");
  const [open] = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.orgId, orgId),
        eq(sessions.contractId, contractId),
        eq(sessions.status, "open"),
        gt(sessions.expiresAt, sql`now()`),
      ),
    );
  if (open)
    throw new DuplicateError(
      "Já existe um checkout aberto para esta contratação. Use o mesmo link ou aguarde ele expirar.",
    );
}

async function loadChargeable(tx: TenantTransaction, orgId: string, contractId: string) {
  const [contract] = await tx
    .select({
      customerId: contracts.customerId,
      offerVersionId: contracts.offerVersionId,
      billingPeriod: contracts.billingPeriod,
      fictitious: contracts.fictitious,
      termEnd: contracts.termEnd,
    })
    .from(contracts)
    .where(and(eq(contracts.orgId, orgId), eq(contracts.id, contractId)));
  if (!contract) throw new NotFoundError();
  await assertNoOtherCheckout(tx, orgId, contractId);
  const items = await tx
    .select({
      position: commercialContractItems.position,
      service: commercialContractItems.service,
      label: commercialContractItems.label,
      unit: commercialContractItems.unit,
      unitAmountCents: commercialContractItems.unitAmountCents,
    })
    .from(commercialContractItems)
    .where(
      and(
        eq(commercialContractItems.orgId, orgId),
        eq(commercialContractItems.contractId, contractId),
      ),
    )
    .orderBy(commercialContractItems.position);
  const users = await tx
    .select({ companyId: commercialContractCompanies.companyId })
    .from(commercialContractCompanies)
    .where(
      and(
        eq(commercialContractCompanies.orgId, orgId),
        eq(commercialContractCompanies.contractId, contractId),
      ),
    );
  const companyIds = users.map((user) => user.companyId);
  const prices = await tx
    .select({
      position: commercialOfferItems.position,
      providerPriceId: billingProviderPrices.providerPriceId,
    })
    .from(billingProviderPrices)
    .innerJoin(
      commercialOfferItems,
      eq(commercialOfferItems.id, billingProviderPrices.offerItemId),
    )
    .where(
      and(
        eq(billingProviderPrices.provider, BILLING_PROVIDER),
        eq(commercialOfferItems.offerVersionId, contract.offerVersionId),
      ),
    );
  const [payer] = await tx
    .select({
      billingEmail: commercialCustomers.billingEmail,
      providerCustomerId: billingProviderCustomers.providerCustomerId,
    })
    .from(commercialCustomers)
    .leftJoin(
      billingProviderCustomers,
      and(
        eq(billingProviderCustomers.customerId, commercialCustomers.id),
        eq(billingProviderCustomers.orgId, commercialCustomers.orgId),
        eq(billingProviderCustomers.provider, BILLING_PROVIDER),
      ),
    )
    .where(
      and(
        eq(commercialCustomers.orgId, orgId),
        eq(commercialCustomers.id, contract.customerId),
      ),
    );
  if (!payer) throw new NotFoundError();
  return {
    contract: { ...contract, companyCount: companyIds.length, companyIds, items },
    prices,
    payer,
  };
}
export type ChargeableContract = Awaited<ReturnType<typeof loadChargeable>>;

export function prepareCheckout(
  ctx: TenantContext,
  contractId: string,
  idempotencyKey: string,
): Promise<
  { kind: "existing"; session: CheckoutSession } | ({ kind: "new" } & ChargeableContract)
> {
  return withOrg(ctx.tenantId, async (tx) => {
    const session = await findByKey(tx, ctx.tenantId, idempotencyKey);
    if (session && session.contractId !== contractId)
      throw new ValidationError("Esta chave já foi usada em outra contratação.");
    if (session) return { kind: "existing", session };
    return { kind: "new", ...(await loadChargeable(tx, ctx.tenantId, contractId)) };
  });
}

export type NewCheckoutSession = {
  id: string;
  contractId: string;
  customerId: string;
  targets: EntitlementTarget[];
  idempotencyKey: string;
  providerSessionId: string;
  url: string;
  expiresAt: Date;
};

export function recordCheckout(
  ctx: TenantContext,
  session: NewCheckoutSession,
): Promise<CheckoutSession> {
  return auditedTenantWrite(ctx.tenantId, "commercial.checkout.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await tx
        .insert(sessions)
        .values({
          ...session,
          orgId: ctx.tenantId,
          provider: BILLING_PROVIDER,
          createdBy: ctx.userId,
        })
        .onConflictDoNothing({ target: [sessions.orgId, sessions.idempotencyKey] });
      const stored = await findByKey(tx, ctx.tenantId, session.idempotencyKey);
      if (!stored) throw new NotFoundError();
      return stored;
    }),
  );
}
