import "server-only";

import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { normalizeStripeEvent } from "@/shared/integrations/stripe/commercial-events";

export async function handleCommercialStripeEvent(event: unknown): Promise<boolean> {
  const enabled = isCommercialCatalogEnabledFor({
    COMMERCIAL_CATALOG_ENABLED: process.env.COMMERCIAL_CATALOG_ENABLED,
  });
  const normalized = enabled ? normalizeStripeEvent(event) : null;
  if (!normalized) return false;
  const ledger = await import("@/shared/db/repositories/billing-ledger");
  const link = await ledger.resolveBillingLink(normalized.reference);
  if (!link) return false;
  await ledger.recordProviderEvent(link, normalized);
  return true;
}
