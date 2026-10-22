import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { CompanyModule } from "@/shared/domains/platform/company-modules";

const MODULE_LITERALS: Record<CompanyModule, SQL> = {
  pgr: sql`'pgr'`,
  medicine: sql`'medicine'`,
};

/** Correlated predicate, also used as a restrictive DB policy (not just hidden UI). */
export function companyModuleScope(
  orgId: SQLWrapper,
  companyId: SQLWrapper,
  module: CompanyModule,
): SQL<boolean> {
  // DDL policies cannot contain query parameters. These are code-owned literals.
  const moduleLiteral = MODULE_LITERALS[module];
  return sql<boolean>`(exists (select 1 from public.company_modules cm where cm.org_id = ${orgId} and cm.company_id = ${companyId} and cm.module = ${moduleLiteral} and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed(${orgId},${companyId},${moduleLiteral})))`;
}
