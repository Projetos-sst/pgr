import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "control_measures",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.control_measures ` +
    `(id, org_id, risk_id, control_level, applicable) values ` +
    `('11111111-1111-1111-1111-1111111111f8','org_b','${PGR_IDS.riskB}','elimination',false)`,
});
