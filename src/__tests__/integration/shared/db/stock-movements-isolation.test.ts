import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "stock_movements",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.stock_movements (org_id, stock_id, type, quantity)
    values ('org_b','${I.epiStockB}','purchase',1)`,
});
