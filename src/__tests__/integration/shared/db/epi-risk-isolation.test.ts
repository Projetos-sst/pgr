import { runIsolationSuite } from "../../_helpers/isolation-suite";
import { PGR_IDS as I } from "../../_helpers/pgr-seed";

runIsolationSuite({
  table: "epi_risk",
  seededCountA: 1,
  // org_id='org_b' com org_a ativo → WITH CHECK rejeita (FKs catalogA/riskA existem, bypassam RLS).
  crossTenantInsertSql: `insert into public.epi_risk (org_id, catalog_id, risk_id, neutralization)
    values ('org_b','${I.epiCatalogA}','${I.riskA}','does_not_neutralize')`,
});
