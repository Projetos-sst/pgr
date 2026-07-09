import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS as I } from "../_helpers/pgr-seed";

// Isolamento (RLS backstop por org_id) das 6 tabelas da fatia Riscos & PGR.
// Cada crossTenantInsertSql tenta gravar uma linha de org_b enquanto org_a está
// fixado → deve ser recusado pelo WITH CHECK (ou por unique/FK, que também provam
// que org_a não consegue escrever dados de org_b).

runIsolationSuite({
  table: "risks",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.risks (org_id, ges_id, agent_type, description)
    values ('org_b','${I.gesB}','physical','Hijack')`,
});

runIsolationSuite({
  table: "risk_assessments",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.risk_assessments
    (org_id, risk_id, criterion, probability, severity, risk_level)
    values ('org_b','${I.riskB}','qualitative',2,2,4)`,
});

runIsolationSuite({
  table: "control_measures",
  seededCountA: 1,
  // 'administrative' não é semeado para riskB → sem colisão de unique; isola o WITH CHECK.
  crossTenantInsertSql: `insert into public.control_measures (org_id, risk_id, control_level)
    values ('org_b','${I.riskB}','administrative')`,
});

runIsolationSuite({
  table: "pgr",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.pgr (org_id, company_id)
    values ('org_b','${I.companyB}')`,
});

runIsolationSuite({
  table: "pgr_ges",
  seededCountA: 1,
  // (pgrB,gesB) já semeado; a recusa vem do WITH CHECK (e/ou do unique) — ambos provam
  // que org_a não escreve vínculo de org_b.
  crossTenantInsertSql: `insert into public.pgr_ges (org_id, pgr_id, ges_id)
    values ('org_b','${I.pgrB}','${I.gesB}')`,
});

runIsolationSuite({
  table: "pgr_revisions",
  seededCountA: 1,
  // revisão 2 não semeada → sem colisão de unique; isola o WITH CHECK.
  crossTenantInsertSql: `insert into public.pgr_revisions (org_id, pgr_id, revision_number)
    values ('org_b','${I.pgrB}',2)`,
});
