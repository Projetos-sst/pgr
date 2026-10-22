import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { isBillingSimulationEnabled } from "@/shared/domains/billing/contracts";
export const commercialEnvironment = () => ({
  APP_ENV: process.env.APP_ENV,
  BILLING_MODE: process.env.BILLING_MODE,
  BILLING_MOCK_ENABLED: process.env.BILLING_MOCK_ENABLED,
});
export function assertCommercialSimulation(ctx: TenantContext) {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o administrador pode acessar o financeiro.");
  if (!isBillingSimulationEnabled(commercialEnvironment()))
    throw new ForbiddenError("Simulação comercial desabilitada neste ambiente.");
}
