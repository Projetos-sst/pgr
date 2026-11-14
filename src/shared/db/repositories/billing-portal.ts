import "server-only";

import { and, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { BILLING_PROVIDER } from "@/shared/domains/commercial/billing-model";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { billingProviderCustomers } from "../schema/billing";
import { commercialContracts } from "../schema/commercial";
import { withOrg } from "../with-org";

export function findPayerProviderCustomerId(
  ctx: TenantContext,
  contractId: string,
): Promise<string | null> {
  return withOrg(ctx.tenantId, async (tx) => {
    const [row] = await tx
      .select({ providerCustomerId: billingProviderCustomers.providerCustomerId })
      .from(commercialContracts)
      .leftJoin(
        billingProviderCustomers,
        and(
          eq(billingProviderCustomers.customerId, commercialContracts.customerId),
          eq(billingProviderCustomers.orgId, commercialContracts.orgId),
          eq(billingProviderCustomers.provider, BILLING_PROVIDER),
        ),
      )
      .where(
        and(
          eq(commercialContracts.orgId, ctx.tenantId),
          eq(commercialContracts.id, contractId),
        ),
      );
    if (!row) throw new NotFoundError();
    return row.providerCustomerId;
  });
}
