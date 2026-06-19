import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "employees",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.employees (org_id, company_id, full_name, cpf)
    values ('org_b','${PGR_IDS.companyB}','X','00000000000')`,
});
