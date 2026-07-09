import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "risks",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.risks (id, org_id, ges_id, agent_type, description) values ` +
    `('11111111-1111-1111-1111-1111111111f8','org_b','${PGR_IDS.gesB}','physical','x')`,
});
