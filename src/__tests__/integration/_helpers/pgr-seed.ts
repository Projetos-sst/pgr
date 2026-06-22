import type postgres from "postgres";

export const PGR_IDS = {
  companyA: "11111111-1111-1111-1111-111111111111",
  companyB: "22222222-2222-2222-2222-222222222222",
  workUnitA: "11111111-1111-1111-1111-1111111111a1",
  workUnitB: "22222222-2222-2222-2222-2222222222b1",
  gesA: "11111111-1111-1111-1111-1111111111a2",
  gesB: "22222222-2222-2222-2222-2222222222b2",
  jobRoleA: "11111111-1111-1111-1111-1111111111a3",
  jobRoleB: "22222222-2222-2222-2222-2222222222b3",
  employeeA: "11111111-1111-1111-1111-1111111111a4",
  employeeB: "22222222-2222-2222-2222-2222222222b4",
  categoryA: "11111111-1111-1111-1111-1111111111a5",
  categoryB: "22222222-2222-2222-2222-2222222222b5",
  gesJobRoleA: "11111111-1111-1111-1111-1111111111a6",
  gesJobRoleB: "22222222-2222-2222-2222-2222222222b6",
} as const;

const I = PGR_IDS;

/**
 * Truncates the whole org graph and seeds one full chain per tenant (org_a/org_b):
 * company → work_unit → ges, job_role, ges_job_roles, employee, category.
 * Inserts run as the admin/owner connection (bypasses RLS).
 */
export async function seedPgrBase(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(
    `truncate table public.orgs, public.users restart identity cascade;`,
  );
  await admin.unsafe(`
    insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');

    insert into public.companies (id, org_id, cnpj, razao_social) values
      ('${I.companyA}','org_a','11111111000111','A Ltda'),
      ('${I.companyB}','org_b','22222222000122','B Ltda');

    insert into public.work_units (id, org_id, company_id, name, description) values
      ('${I.workUnitA}','org_a','${I.companyA}','WU A','desc'),
      ('${I.workUnitB}','org_b','${I.companyB}','WU B','desc');

    insert into public.ges (id, org_id, company_id, work_unit_id, name) values
      ('${I.gesA}','org_a','${I.companyA}','${I.workUnitA}','GES A'),
      ('${I.gesB}','org_b','${I.companyB}','${I.workUnitB}','GES B');

    insert into public.job_roles (id, org_id, company_id, title) values
      ('${I.jobRoleA}','org_a','${I.companyA}','Pedreiro'),
      ('${I.jobRoleB}','org_b','${I.companyB}','Eletricista');

    insert into public.categories (id, org_id, type, name) values
      ('${I.categoryA}','org_a','epi','Capacete'),
      ('${I.categoryB}','org_b','machine','Betoneira');

    insert into public.employees (id, org_id, company_id, ges_id, job_role_id, full_name, cpf) values
      ('${I.employeeA}','org_a','${I.companyA}','${I.gesA}','${I.jobRoleA}','Func A','12345678901'),
      ('${I.employeeB}','org_b','${I.companyB}','${I.gesB}','${I.jobRoleB}','Func B','98765432100');

    insert into public.ges_job_roles (id, org_id, ges_id, job_role_id, worker_count) values
      ('${I.gesJobRoleA}','org_a','${I.gesA}','${I.jobRoleA}',3),
      ('${I.gesJobRoleB}','org_b','${I.gesB}','${I.jobRoleB}',7);
  `);
}
