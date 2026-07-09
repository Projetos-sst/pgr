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
  epiCatalogA: "11111111-1111-1111-1111-1111111111a7",
  epiCatalogB: "22222222-2222-2222-2222-2222222222b7",
  epiStockA: "11111111-1111-1111-1111-1111111111a8",
  epiStockB: "22222222-2222-2222-2222-2222222222b8",
  epiDeliveryA: "11111111-1111-1111-1111-1111111111a9",
  epiDeliveryB: "22222222-2222-2222-2222-2222222222b9",
  // Módulo de Riscos & PGR (fatia pgr-risk-data-model).
  riskA: "11111111-1111-1111-1111-1111111111d1",
  riskB: "22222222-2222-2222-2222-2222222222e1",
  riskAssessmentA: "11111111-1111-1111-1111-1111111111d2",
  riskAssessmentB: "22222222-2222-2222-2222-2222222222e2",
  controlMeasureA: "11111111-1111-1111-1111-1111111111d3",
  controlMeasureB: "22222222-2222-2222-2222-2222222222e3",
  pgrA: "11111111-1111-1111-1111-1111111111d4",
  pgrB: "22222222-2222-2222-2222-2222222222e4",
  pgrGesA: "11111111-1111-1111-1111-1111111111d5",
  pgrGesB: "22222222-2222-2222-2222-2222222222e5",
  pgrRevisionA: "11111111-1111-1111-1111-1111111111d6",
  pgrRevisionB: "22222222-2222-2222-2222-2222222222e6",
} as const;

const I = PGR_IDS;

/**
 * Truncates the whole org graph and seeds one full chain per tenant (org_a/org_b):
 * company → work_unit → ges, job_role, ges_job_roles, employee, category, the EPI
 * chain (catalog → stock → movement, delivery → item, epi_risk), and the Risk & PGR
 * chain (risk → assessment, control_measure; pgr → pgr_ges, pgr_revision).
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

    insert into public.epi_catalog (id, org_id, type, category_id, name) values
      ('${I.epiCatalogA}','org_a','epi','${I.categoryA}','Capacete CA-123'),
      ('${I.epiCatalogB}','org_b','machine','${I.categoryB}','Betoneira 400L');

    insert into public.epi_stock (id, org_id, catalog_id, balance, min_quantity) values
      ('${I.epiStockA}','org_a','${I.epiCatalogA}',10,2),
      ('${I.epiStockB}','org_b','${I.epiCatalogB}',5,1);

    insert into public.stock_movements (org_id, stock_id, type, quantity) values
      ('org_a','${I.epiStockA}','purchase',10),
      ('org_b','${I.epiStockB}','purchase',5);

    insert into public.epi_deliveries (id, org_id, employee_id, signature_status) values
      ('${I.epiDeliveryA}','org_a','${I.employeeA}','pending'),
      ('${I.epiDeliveryB}','org_b','${I.employeeB}','signed_manual');

    insert into public.epi_delivery_items (org_id, delivery_id, catalog_id, quantity) values
      ('org_a','${I.epiDeliveryA}','${I.epiCatalogA}',1),
      ('org_b','${I.epiDeliveryB}','${I.epiCatalogB}',1);

    insert into public.risks (id, org_id, ges_id, agent_type, description) values
      ('${I.riskA}','org_a','${I.gesA}','physical','Ruído contínuo'),
      ('${I.riskB}','org_b','${I.gesB}','chemical','Poeira de sílica');

    insert into public.epi_risk (org_id, catalog_id, risk_id, neutralization) values
      ('org_a','${I.epiCatalogA}','${I.riskA}','neutralizes'),
      ('org_b','${I.epiCatalogB}','${I.riskB}','does_not_neutralize');

    insert into public.risk_assessments
      (id, org_id, risk_id, criterion, probability, severity, risk_level) values
      ('${I.riskAssessmentA}','org_a','${I.riskA}','qualitative',3,3,9),
      ('${I.riskAssessmentB}','org_b','${I.riskB}','quantitative',2,4,8);

    insert into public.control_measures
      (id, org_id, risk_id, control_level, applicable) values
      ('${I.controlMeasureA}','org_a','${I.riskA}','elimination',false),
      ('${I.controlMeasureB}','org_b','${I.riskB}','ppe',true);

    insert into public.pgr (id, org_id, company_id, work_unit_id) values
      ('${I.pgrA}','org_a','${I.companyA}','${I.workUnitA}'),
      ('${I.pgrB}','org_b','${I.companyB}','${I.workUnitB}');

    insert into public.pgr_ges (id, org_id, pgr_id, ges_id) values
      ('${I.pgrGesA}','org_a','${I.pgrA}','${I.gesA}'),
      ('${I.pgrGesB}','org_b','${I.pgrB}','${I.gesB}');

    insert into public.pgr_revisions (id, org_id, pgr_id, revision_number) values
      ('${I.pgrRevisionA}','org_a','${I.pgrA}',1),
      ('${I.pgrRevisionB}','org_b','${I.pgrB}',1);
  `);
}
