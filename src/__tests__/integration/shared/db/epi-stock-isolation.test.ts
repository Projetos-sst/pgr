import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_stock",
  seededCountA: 1,
  // catalogA pertence a org_a: não colide com uq_epi_stock_org_catalog de org_b,
  // logo a rejeição vem do WITH CHECK (org_id), não do índice único.
  crossTenantInsertSql: `insert into public.epi_stock (org_id, catalog_id, balance, min_quantity)
    values ('org_b','${I.epiCatalogA}',1,0)`,
});
