import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_risk",
  seededCountA: 1,
  // (catalogA, gesA) não colide com uq_epi_risk_org_catalog_ges de org_b → WITH CHECK rejeita.
  crossTenantInsertSql: `insert into public.epi_risk (org_id, catalog_id, ges_id, neutralizes)
    values ('org_b','${I.epiCatalogA}','${I.gesA}',false)`,
});
