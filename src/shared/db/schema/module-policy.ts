import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { CompanyModule } from "@/shared/domains/platform/company-modules";

/** Correlated predicate, also used as a restrictive DB policy (not just hidden UI). */
export function companyModuleScope(
  orgId: SQLWrapper,
  companyId: SQLWrapper,
  module: CompanyModule,
): SQL {
  // DDL policies cannot contain query parameters. These are code-owned literals.
  const moduleLiteral = module === "pgr" ? sql`'pgr'` : sql`'medicine'`;
  return sql`exists (select 1 from public.company_modules cm where cm.org_id = ${orgId} and cm.company_id = ${companyId} and cm.module = ${moduleLiteral} and cm.enabled = true)`;
}
