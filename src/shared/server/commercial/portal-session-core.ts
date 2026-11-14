import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { findPayerProviderCustomerId } from "@/shared/db/repositories/billing-portal";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { createCommercialPortalSession as openPortalSession } from "@/shared/integrations/stripe/client";
import {
  getAppBaseUrl,
  getStripeConfig,
  isStripeTestMode,
} from "@/shared/integrations/stripe/config";

import { requireFinancialOwner } from "./commercial-core";

const contractIdSchema = requiredUuid("Contratação inválida.");

const NO_PROVIDER_CUSTOMER_MESSAGE =
  "Este pagador ainda não tem cadastro no provedor de pagamento. Conclua o pagamento da contratação antes de abrir o portal.";

export function isPaymentAvailable(): boolean {
  const config = getStripeConfig();
  return config !== null && isStripeTestMode(config);
}

export async function createCommercialPortalSession(
  ctx: TenantContext,
  contractId: string,
): Promise<{ url: string }> {
  requireFinancialOwner(ctx);
  const id = contractIdSchema.parse(contractId);
  if (!isPaymentAvailable()) throw new BillingUnavailableError();
  const providerCustomerId = await findPayerProviderCustomerId(ctx, id);
  if (providerCustomerId === null)
    throw new ValidationError(NO_PROVIDER_CUSTOMER_MESSAGE);
  const session = await openPortalSession(
    providerCustomerId,
    `${getAppBaseUrl()}/plans/subscription`,
  );
  return { url: session.url };
}
