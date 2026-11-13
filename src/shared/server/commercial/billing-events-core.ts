import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as ledger from "@/shared/db/repositories/billing-ledger";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import { requireFinancialOwner } from "./commercial-core";

const contractIdSchema = requiredUuid("Contratação inválida.");

export async function getContractBilling(ctx: TenantContext, contractId: string) {
  requireFinancialOwner(ctx);
  return ledger.getContractBilling(ctx, contractIdSchema.parse(contractId));
}
