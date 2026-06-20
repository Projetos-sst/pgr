import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "work_units",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.work_units (org_id, company_id, name, description) values ('org_b','${PGR_IDS.companyB}','Hijack','x')`,
});
