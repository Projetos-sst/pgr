import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

/**
 * RLS backstop da tabela `pgr`: cada tenant vê apenas suas linhas; query sem tenant
 * fixado retorna 0; INSERT cross-tenant é rejeitado pelo WITH CHECK.
 */
runIsolationSuite({
  table: "pgr",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.pgr (id, org_id, company_id, work_unit_id) values ` +
    `('11111111-1111-1111-1111-1111111111f9','org_b','${PGR_IDS.companyB}','${PGR_IDS.workUnitB}')`,
});
