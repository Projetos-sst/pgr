import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "risk_assessments",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.risk_assessments ` +
    `(id, org_id, risk_id, criterion, probability, severity, risk_level) values ` +
    `('11111111-1111-1111-1111-1111111111f9','org_b','${PGR_IDS.riskB}','qualitative',2,4,8)`,
});
