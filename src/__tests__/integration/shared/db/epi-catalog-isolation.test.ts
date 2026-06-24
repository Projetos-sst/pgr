import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_catalog",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.epi_catalog (org_id, type, category_id, name)
    values ('org_b','epi','${I.categoryB}','X')`,
});
