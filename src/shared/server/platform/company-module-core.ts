import "server-only";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { companyModuleChangeSchema } from "@/shared/domains/platform/company-modules";
import * as repo from "@/shared/db/repositories/company-modules";
import type { PageParams } from "@/shared/pagination";

export async function getCompanyModuleOverview(
  ctx: TenantContext,
  companyId: string,
  page: PageParams = {},
) {
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const modules = await repo.getCompanyModules(ctx.tenantId, id);
  const history = await repo.listCompanyModuleEvents(ctx.tenantId, id, page);
  return { modules, history };
}

export async function changeCompanyModule(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o administrador pode alterar os serviços da empresa.",
    );
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const change = companyModuleChangeSchema.parse(input);
  await repo.setCompanyModule(ctx.tenantId, id, ctx.userId, change);
  return repo.getCompanyModules(ctx.tenantId, id);
}
