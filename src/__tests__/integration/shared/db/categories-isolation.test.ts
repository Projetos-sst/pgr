import { runIsolationSuite } from "../../_helpers/isolation-suite";

runIsolationSuite({
  table: "categories",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.categories (org_id, type, name)
    values ('org_b','epi','X')`,
});
