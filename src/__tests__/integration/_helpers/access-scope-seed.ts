import type postgres from "postgres";

import { PGR_IDS as I } from "./pgr-seed";

export const ACCESS_IDS = {
  owner: "scope-owner",
  clerkAdmin: "scope-clerk-admin",
  legacy: "scope-legacy",
  scoped: "scope-collaborator",
  healthOnly: "scope-health",
  representative: "scope-representative",
  companyA2: "33333333-3333-3333-3333-333333333333",
  workUnitA_2: "11111111-1111-1111-1111-1111111111c1",
  workUnitA2: "33333333-3333-3333-3333-3333333333c1",
  gesA_2: "11111111-1111-1111-1111-1111111111c2",
  gesA2: "33333333-3333-3333-3333-3333333333c2",
  jobRoleA2: "33333333-3333-3333-3333-3333333333c3",
  employeeA2: "33333333-3333-3333-3333-3333333333c4",
  riskA2: "33333333-3333-3333-3333-3333333333c5",
  pgrA_workUnit2: "11111111-1111-1111-1111-1111111111c6",
  pgrA_companyWide: "11111111-1111-1111-1111-1111111111c7",
  pgrA2: "33333333-3333-3333-3333-3333333333c6",
  examA: "11111111-1111-1111-1111-1111111111c8",
  examA2: "33333333-3333-3333-3333-3333333333c8",
  accidentA: "11111111-1111-1111-1111-1111111111c9",
  accidentA2: "33333333-3333-3333-3333-3333333333c9",
};

const X = ACCESS_IDS;

export async function seedAccessScopeFixtures(
  admin: ReturnType<typeof postgres>,
): Promise<void> {
  await admin.unsafe(`
    insert into public.users (id, email) values
      ('${X.owner}','owner@scope.test'), ('${X.clerkAdmin}','admin@scope.test'),
      ('${X.legacy}','legacy@scope.test'), ('${X.scoped}','scoped@scope.test'),
      ('${X.healthOnly}','health@scope.test'), ('${X.representative}','rep@scope.test');

    insert into public.org_memberships (org_id, user_id, role) values
      ('org_a','${X.owner}','owner'), ('org_a','${X.clerkAdmin}','org:admin'),
      ('org_a','${X.legacy}','collaborator'), ('org_a','${X.scoped}','org:member'),
      ('org_a','${X.healthOnly}','collaborator'), ('org_a','${X.representative}','client');

    insert into public.companies (id, org_id, cnpj, razao_social) values
      ('${X.companyA2}','org_a','33444555000181','A2 Ltda');

    insert into public.company_modules (org_id, company_id, module, enabled) values
      ('org_a','${X.companyA2}','pgr',true), ('org_a','${X.companyA2}','medicine',true);

    insert into public.work_units (id, org_id, company_id, name, description) values
      ('${X.workUnitA_2}','org_a','${I.companyA}','WU A-2','desc'),
      ('${X.workUnitA2}','org_a','${X.companyA2}','WU A2','desc');

    insert into public.ges (id, org_id, company_id, work_unit_id, name) values
      ('${X.gesA_2}','org_a','${I.companyA}','${X.workUnitA_2}','GES A-2'),
      ('${X.gesA2}','org_a','${X.companyA2}','${X.workUnitA2}','GES A2');

    insert into public.job_roles (id, org_id, company_id, title) values
      ('${X.jobRoleA2}','org_a','${X.companyA2}','Soldador');

    insert into public.employees (id, org_id, company_id, ges_id, job_role_id, full_name, cpf) values
      ('${X.employeeA2}','org_a','${X.companyA2}','${X.gesA2}','${X.jobRoleA2}','Func A2','11122233344');

    insert into public.risks (id, org_id, ges_id, agent_type, description) values
      ('${X.riskA2}','org_a','${X.gesA2}','physical','Calor');

    insert into public.pgr (id, org_id, company_id, work_unit_id) values
      ('${X.pgrA_workUnit2}','org_a','${I.companyA}','${X.workUnitA_2}'),
      ('${X.pgrA_companyWide}','org_a','${I.companyA}',null),
      ('${X.pgrA2}','org_a','${X.companyA2}','${X.workUnitA2}');

    insert into public.health_exams (id, org_id, employee_id, exam_type, performed_at, aptitude) values
      ('${X.examA}','org_a','${I.employeeA}','admissional','2026-01-01','fit'),
      ('${X.examA2}','org_a','${X.employeeA2}','admissional','2026-01-01','fit');

    insert into public.accidents (id, org_id, number, company_id, occurred_at, type, category, severity) values
      ('${X.accidentA}','org_a',1,'${I.companyA}','2026-01-01T12:00:00Z','typical','without_leave','minor'),
      ('${X.accidentA2}','org_a',2,'${X.companyA2}','2026-01-01T12:00:00Z','typical','without_leave','minor');
  `);
}
