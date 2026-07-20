import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "pgr_ges",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.pgr_ges (id, org_id, pgr_id, ges_id) values ` +
    `('11111111-1111-1111-1111-1111111111f7','org_b','${PGR_IDS.pgrB}','${PGR_IDS.gesB}')`,
});

runIsolationSuite({
  table: "pgr_revisions",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.pgr_revisions (id, org_id, pgr_id, revision_number) values ` +
    `('11111111-1111-1111-1111-1111111111f6','org_b','${PGR_IDS.pgrB}',2)`,
});
