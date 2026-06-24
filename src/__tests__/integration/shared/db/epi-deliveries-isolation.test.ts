import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_deliveries",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.epi_deliveries (org_id, employee_id)
    values ('org_b','${I.employeeB}')`,
});
