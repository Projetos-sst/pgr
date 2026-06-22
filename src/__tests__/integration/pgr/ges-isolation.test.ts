import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "ges",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.ges (org_id, company_id, work_unit_id, name) values ('org_b','${PGR_IDS.companyB}','${PGR_IDS.workUnitB}','Hijack')`,
});

runIsolationSuite({
  table: "ges_job_roles",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.ges_job_roles (org_id, ges_id, job_role_id, worker_count) values ('org_b','${PGR_IDS.gesB}','${PGR_IDS.jobRoleB}',1)`,
});
