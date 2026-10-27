import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { isBillingSimulationEnabled } from "@/shared/domains/billing/contracts";
export const commercialEnvironment = () => ({
  APP_ENV: process.env.APP_ENV,
  BILLING_MODE: process.env.BILLING_MODE,
  BILLING_MOCK_ENABLED: process.env.BILLING_MOCK_ENABLED,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
});
export function assertCommercialSimulation(ctx: TenantContext) {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o administrador pode acessar o financeiro.");
  if (!isBillingSimulationEnabled(commercialEnvironment()))
    throw new ForbiddenError("Simulação comercial desabilitada neste ambiente.");
}
export function assertCommercialOperationalAccess(ctx: TenantContext) {
  if (!["owner", "collaborator"].includes(ctx.role))
    throw new ForbiddenError("Acesso operacional não autorizado.");
  if (!isBillingSimulationEnabled(commercialEnvironment()))
    throw new ForbiddenError("Simulação comercial desabilitada neste ambiente.");
}
