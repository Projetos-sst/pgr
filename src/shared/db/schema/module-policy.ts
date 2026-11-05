import { Column, getTableName, is, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { CompanyModule } from "@/shared/domains/platform/company-modules";

const MODULE_LITERALS: Record<CompanyModule, SQL> = {
  pgr: sql`'pgr'`,
  medicine: sql`'medicine'`,
};

/**
 * Coluna sempre qualificada pela tabela (`"companies"."id"`). O drizzle omite o nome da tabela
 * nas colunas do SELECT de consulta com uma tabela só; dentro da subconsulta abaixo, `"id"` e
 * `"org_id"` passariam a apontar para `company_modules` (NOB-170: a listagem dizia "Sem módulos"
 * para empresas habilitadas). Em WHERE e nas policies o texto gerado é o mesmo de antes.
 */
function qualified(ref: SQLWrapper): SQLWrapper {
  if (!is(ref, Column)) return ref;
  return sql`${sql.identifier(getTableName(ref.table))}.${sql.identifier(ref.name)}`;
}

/** Correlated predicate, also used as a restrictive DB policy (not just hidden UI). */
export function companyModuleScope(
  orgId: SQLWrapper,
  companyId: SQLWrapper,
  module: CompanyModule,
): SQL<boolean> {
  // DDL policies cannot contain query parameters. These are code-owned literals.
  const moduleLiteral = MODULE_LITERALS[module];
  return sql<boolean>`exists (select 1 from public.company_modules cm where cm.org_id = ${qualified(orgId)} and cm.company_id = ${qualified(companyId)} and cm.module = ${moduleLiteral} and cm.enabled = true)`;
}
