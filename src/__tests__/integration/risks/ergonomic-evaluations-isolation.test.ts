import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

/**
 * Backstop de RLS da tabela nova da #40. O seed base não cobre
 * `ergonomic_evaluations`, então a suíte semeia uma linha por tenant.
 */
runIsolationSuite({
  table: "ergonomic_evaluations",
  seededCountA: 1,
  extraSeedSql:
    `insert into public.ergonomic_evaluations ` +
    `(id, org_id, risk_id, assessed_at, posture) values ` +
    `('11111111-1111-1111-1111-1111111111fa','org_a','${PGR_IDS.riskA}','2026-01-01','adequate'), ` +
    `('22222222-2222-2222-2222-2222222222fa','org_b','${PGR_IDS.riskB}','2026-01-01','inadequate')`,
  crossTenantInsertSql:
    `insert into public.ergonomic_evaluations ` +
    `(id, org_id, risk_id, assessed_at) values ` +
    `('11111111-1111-1111-1111-1111111111fb','org_b','${PGR_IDS.riskB}','2026-02-01')`,
});
