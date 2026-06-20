import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "ges",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.ges (org_id, company_id, work_unit_id, name)
    values ('org_b','${PGR_IDS.companyB}','${PGR_IDS.workUnitB}','X')`,
});
