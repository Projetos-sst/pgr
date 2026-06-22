import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "job_roles",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.job_roles (org_id, company_id, title)
    values ('org_b','${PGR_IDS.companyB}','X')`,
});
