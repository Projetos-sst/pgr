import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { companyCreateSchema } from "@/shared/domains/pgr/companies";
import { createCompany } from "@/shared/db/repositories/companies";

/** Action and REST share authorization and the atomic company/module/audit write. */
export async function registerCompany(ctx: TenantContext, raw: unknown) {
  if (!["owner", "collaborator"].includes(ctx.role)) throw new ForbiddenError();
  const { initialModules, moduleReason, ...company } = companyCreateSchema.parse(raw);
  if (initialModules.length && ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o administrador pode habilitar os serviços da empresa.",
    );
  return createCompany(ctx.tenantId, company, {
    actor: ctx.userId,
    modules: initialModules,
    reason: moduleReason,
  });
}
