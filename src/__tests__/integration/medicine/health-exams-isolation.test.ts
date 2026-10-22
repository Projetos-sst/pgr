import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS as I } from "../_helpers/pgr-seed";

// health_exams não está no seed base: um exame fictício por tenant. As empresas do
// seed base têm Medicina ligada, então a policy RESTRICTIVE de módulo não interfere
// na contagem — o que se prova aqui é o backstop por org_id.
runIsolationSuite({
  table: "health_exams",
  seededCountA: 1,
  extraSeedSql: `
    insert into public.health_exams (org_id, employee_id, exam_type, performed_at, aptitude) values
      ('org_a','${I.employeeA}','admissional','2026-01-10','fit'),
      ('org_b','${I.employeeB}','periodic','2026-01-20','fit');
  `,
  crossTenantInsertSql: `
    insert into public.health_exams (org_id, employee_id, exam_type, performed_at, aptitude)
    values ('org_b','${I.employeeB}','admissional','2026-01-10','fit')
  `,
});
