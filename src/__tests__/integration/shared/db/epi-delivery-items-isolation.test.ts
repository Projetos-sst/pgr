import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_delivery_items",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.epi_delivery_items (org_id, delivery_id, catalog_id, quantity)
    values ('org_b','${I.epiDeliveryB}','${I.epiCatalogB}',1)`,
});
