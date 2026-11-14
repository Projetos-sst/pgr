import "server-only";

import { ForbiddenError } from "@/shared/auth/errors";
import * as repository from "@/shared/db/repositories/admin-subscriptions";
import {
  adminSubscriptionFiltersSchema,
  reconcileInputSchema,
  targetSchema,
  type AdminSubscriptionDetail,
  type AdminSubscriptionRow,
  type ReconcileOutcome,
  type SubscriptionLookup,
} from "@/shared/domains/commercial/admin-subscriptions";
import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { retrieveCommercialSubscription } from "@/shared/integrations/stripe/client";
import type { Paginated } from "@/shared/pagination";

import { commercialEnvironment } from "./environment";

export type PlatformOperator = { userId: string };

export function isAdminPanelEnabled(): boolean {
  return isCommercialCatalogEnabledFor(commercialEnvironment());
}

async function authorize(operator: PlatformOperator): Promise<void> {
  if (!isAdminPanelEnabled()) throw new ForbiddenError("Recurso indisponível.");
  if (!(await repository.isPlatformOperator(operator.userId)))
    throw new ForbiddenError("Acesso restrito a administradores da plataforma.");
}

export async function listAdminSubscriptions(
  operator: PlatformOperator,
  input: unknown,
): Promise<Paginated<AdminSubscriptionRow>> {
  await authorize(operator);
  return repository.listAdminSubscriptions(
    operator.userId,
    adminSubscriptionFiltersSchema.parse(input ?? {}),
  );
}

export async function getAdminSubscription(
  operator: PlatformOperator,
  orgId: unknown,
  contractId: unknown,
): Promise<AdminSubscriptionDetail> {
  await authorize(operator);
  const target = targetSchema.parse({ orgId, contractId });
  return repository.getAdminSubscription(
    operator.userId,
    target.orgId,
    target.contractId,
  );
}

function sourceLookup(
  providerSubscriptionId: string | null,
): Promise<SubscriptionLookup> {
  if (!providerSubscriptionId)
    return Promise.resolve({ ok: false, reason: "no_subscription_mirror" });
  return retrieveCommercialSubscription(providerSubscriptionId);
}

function sameSubscription(
  lookup: SubscriptionLookup,
  providerSubscriptionId: string | null,
): SubscriptionLookup {
  if (!lookup.ok || lookup.snapshot.providerSubscriptionId === providerSubscriptionId)
    return lookup;
  return { ok: false, reason: "provider_subscription_mismatch" };
}

export async function reconcileSubscription(
  operator: PlatformOperator,
  input: unknown,
): Promise<ReconcileOutcome> {
  await authorize(operator);
  const request = reconcileInputSchema.parse(input);
  const contract = await repository.findReconcilableContract(
    operator.userId,
    request.orgId,
    request.contractId,
  );
  if (!contract) throw new NotFoundError();
  const lookup = sameSubscription(
    await sourceLookup(contract.providerSubscriptionId),
    contract.providerSubscriptionId,
  );
  return repository.applyReconciliation({
    operatorId: operator.userId,
    orgId: request.orgId,
    contractId: request.contractId,
    reason: request.reason,
    lookup,
  });
}
