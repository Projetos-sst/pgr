import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const ORG_ID = "org_3ECY5T4eOq6AOXciWWdK3G2vzGD";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED não encontrada em .env.local");

  const sql = postgres(url);
  console.log(`Iniciando seed para a organização dev: ${ORG_ID}...`);

  // Ensure organization exists with pro plan
  await sql`
    insert into public.orgs (id, name, slug, plan)
    values (${ORG_ID}, 'sst-manager-development', 'sst-manager-development', 'pro')
    on conflict (id) do update set name = 'sst-manager-development', plan = 'pro';
  `;

  // Get existing companies or create sample companies
  let companies = await sql`select id from public.companies where org_id = ${ORG_ID}`;
  if (companies.length === 0) {
    const compA = crypto.randomUUID();
    const compB = crypto.randomUUID();
    await sql`
      insert into public.companies (id, org_id, cnpj, razao_social)
      values
        (${compA}, ${ORG_ID}, '11111111000111', 'Acme Indústria & Comércio S.A.'),
        (${compB}, ${ORG_ID}, '22222222000122', 'Construtora Horizonte Ltda');
    `;
    companies = await sql`select id from public.companies where org_id = ${ORG_ID}`;
  }

  const compId = companies[0].id;

  // Insert Work Units
  const wu1 = crypto.randomUUID();
  const wu2 = crypto.randomUUID();
  await sql`
    insert into public.work_units (id, org_id, company_id, name, description)
    values
      (${wu1}, ${ORG_ID}, ${compId}, 'Unidade Matriz - Fábrica', 'Planta fabril principal'),
      (${wu2}, ${ORG_ID}, ${compId}, 'Unidade Obra Sul', 'Canteiro de obras e edificação')
    on conflict do nothing;
  `;

  // Insert GES (Grupos de Exposição Similar)
  const ges1 = crypto.randomUUID();
  const ges2 = crypto.randomUUID();
  const ges3 = crypto.randomUUID();
  await sql`
    insert into public.ges (id, org_id, company_id, work_unit_id, name)
    values
      (${ges1}, ${ORG_ID}, ${compId}, ${wu1}, 'Operadores de Prensa e Usinagem'),
      (${ges2}, ${ORG_ID}, ${compId}, ${wu1}, 'Técnicos de Manutenção Elétrica'),
      (${ges3}, ${ORG_ID}, ${compId}, ${wu2}, 'Equipe de Alvenaria e Estrutura')
    on conflict do nothing;
  `;

  // Insert Job Roles
  const jr1 = crypto.randomUUID();
  const jr2 = crypto.randomUUID();
  const jr3 = crypto.randomUUID();
  await sql`
    insert into public.job_roles (id, org_id, company_id, title)
    values
      (${jr1}, ${ORG_ID}, ${compId}, 'Operador de Máquinas'),
      (${jr2}, ${ORG_ID}, ${compId}, 'Eletricista Industrial'),
      (${jr3}, ${ORG_ID}, ${compId}, 'Pedreiro de Edificações')
    on conflict do nothing;
  `;

  // Fetch employee IDs
  let empList = await sql`select id from public.employees where org_id = ${ORG_ID}`;
  if (empList.length === 0) {
    const empIds = Array.from({ length: 47 }, () => crypto.randomUUID());
    for (let i = 0; i < empIds.length; i++) {
      const gesId = i % 3 === 0 ? ges1 : i % 3 === 1 ? ges2 : ges3;
      const jrId = i % 3 === 0 ? jr1 : i % 3 === 1 ? jr2 : jr3;
      const cpf = String(10000000000 + i);
      await sql`
        insert into public.employees (id, org_id, company_id, ges_id, job_role_id, full_name, cpf)
        values (${empIds[i]}, ${ORG_ID}, ${compId}, ${gesId}, ${jrId}, ${`Colaborador ${i + 1}`}, ${cpf})
        on conflict do nothing;
      `;
    }
    empList = await sql`select id from public.employees where org_id = ${ORG_ID}`;
  }

  const activeEmpIds = empList.map((e) => e.id);

  // Insert Categories & EPI Catalog
  const existingCats = await sql`
    select id from public.categories where org_id = ${ORG_ID} and type = 'epi' limit 1
  `;
  let catEpi: string;
  if (existingCats.length > 0) {
    catEpi = existingCats[0].id;
  } else {
    catEpi = crypto.randomUUID();
    await sql`
      insert into public.categories (id, org_id, type, name)
      values (${catEpi}, ${ORG_ID}, 'epi', 'Proteção Auditiva')
      on conflict do nothing;
    `;
  }

  const epiCat1 = crypto.randomUUID();
  const epiCat2 = crypto.randomUUID();
  await sql`
    insert into public.epi_catalog (id, org_id, type, category_id, name)
    values
      (${epiCat1}, ${ORG_ID}, 'epi', ${catEpi}, 'Protetor Auricular Tipo Concha CA-1234'),
      (${epiCat2}, ${ORG_ID}, 'epi', ${catEpi}, 'Capacete de Segurança com Carneira CA-5678')
    on conflict do nothing;
  `;

  const stock1 = crypto.randomUUID();
  const stock2 = crypto.randomUUID();
  await sql`
    insert into public.epi_stock (id, org_id, catalog_id, balance, min_quantity)
    values
      (${stock1}, ${ORG_ID}, ${epiCat1}, 15, 20),
      (${stock2}, ${ORG_ID}, ${epiCat2}, 4, 10)
    on conflict do nothing;
  `;

  // Insert Risks across all 5 agent types (Physical, Chemical, Ergonomic, Biological, Accident)
  const risksData = [
    { type: "physical", desc: "Ruído contínuo de prensas (88 dB)" },
    { type: "physical", desc: "Vibração de mãos e braços" },
    { type: "physical", desc: "Calor excessivo em fundição" },
    { type: "chemical", desc: "Poeira mineral e névoas de óleo" },
    { type: "chemical", desc: "Vapores orgânicos em pintura" },
    { type: "ergonomic", desc: "Postura inadequada no manuseio de peças" },
    { type: "ergonomic", desc: "Levantamento manual de peso constante" },
    { type: "biological", desc: "Exposição a micro-organismos no esgoto" },
    { type: "accident", desc: "Risco de queda de altura em andaime" },
    { type: "accident", desc: "Corte e prensamento em partes móveis" },
  ];

  for (const r of risksData) {
    const rId = crypto.randomUUID();
    await sql`
      insert into public.risks (id, org_id, ges_id, agent_type, description)
      values (${rId}, ${ORG_ID}, ${ges1}, ${r.type}, ${r.desc})
      on conflict do nothing;
    `;

    // Assessment
    const raId = crypto.randomUUID();
    await sql`
      insert into public.risk_assessments (id, org_id, risk_id, criterion, probability, severity, risk_level)
      values (${raId}, ${ORG_ID}, ${rId}, 'qualitative', 3, 3, 9)
      on conflict do nothing;
    `;

    // Control Measure / Plan
    const cmId = crypto.randomUUID();
    const levels = ["elimination", "collective_protection", "administrative", "ppe"];
    const level = levels[Math.floor(Math.random() * levels.length)];
    await sql`
      insert into public.control_measures (id, org_id, risk_id, control_level, applicable)
      values (${cmId}, ${ORG_ID}, ${rId}, ${level}, true)
      on conflict do nothing;
    `;
  }

  // Insert Service Orders (Ordens de Serviço)
  const soStatuses = [
    ...Array(14).fill("completed"),
    ...Array(4).fill("in_progress"),
    ...Array(2).fill("open"),
    ...Array(3).fill("cancelled"),
  ];
  for (let i = 0; i < soStatuses.length; i++) {
    const soId = crypto.randomUUID();
    const status = soStatuses[i];
    await sql`
      insert into public.service_orders (id, org_id, number, title, assigned_employee_id, opened_at, status)
      values (
        ${soId},
        ${ORG_ID},
        ${i + 1},
        ${`Ordem de Serviço OS-${100 + i + 1} - NR-01 / NR-12`},
        ${activeEmpIds[i % activeEmpIds.length]},
        '2026-07-01',
        ${status}
      )
      on conflict do nothing;
    `;
  }

  // Insert Accidents/Incidents
  const accData = [
    { status: "registered", type: "typical", severity: "minor" },
    { status: "registered", type: "typical", severity: "minor" },
    { status: "awaiting_planning", type: "commute", severity: "moderate" },
    { status: "awaiting_planning", type: "typical", severity: "moderate" },
    { status: "awaiting_completion", type: "occupational_disease", severity: "minor" },
    { status: "awaiting_completion", type: "typical", severity: "moderate" },
    { status: "completed", type: "typical", severity: "minor" },
    { status: "completed", type: "commute", severity: "minor" },
    { status: "completed", type: "typical", severity: "moderate" },
    { status: "completed", type: "typical", severity: "minor" },
    { status: "completed", type: "occupational_disease", severity: "minor" },
    { status: "cancelled", type: "commute", severity: "minor" },
  ];

  for (let i = 0; i < accData.length; i++) {
    const acc = accData[i];
    const accId = crypto.randomUUID();
    await sql`
      insert into public.accidents (
        id, org_id, company_id, employee_id, occurred_at, type, category, severity, status, location, description
      ) values (
        ${accId},
        ${ORG_ID},
        ${compId},
        ${activeEmpIds[i % activeEmpIds.length]},
        '2026-07-15 10:00:00Z',
        ${acc.type},
        'without_leave',
        ${acc.severity},
        ${acc.status},
        'Setor de Produção',
        ${`Relato de incidente operacional #${i + 1}`}
      )
      on conflict do nothing;
    `;
  }

  // Insert Sample Documents for GED
  const sampleDocs = [
    {
      name: "PGR — Kairós Motores 2026",
      docType: "Programa",
      version: 2,
      sizeBytes: 3450000,
      validUntil: "2027-05-15",
    },
    {
      name: "PCMSO — Ktec 2026",
      docType: "Programa",
      version: 1,
      sizeBytes: 2890000,
      validUntil: "2027-03-10",
    },
    {
      name: "Laudo Ergonômico — Escritório",
      docType: "Laudo",
      version: 1,
      sizeBytes: 1540000,
      validUntil: "2026-08-10",
    },
    {
      name: "Procedimento — Trabalho a Quente",
      docType: "Procedimento",
      version: 3,
      sizeBytes: 890000,
      validUntil: null,
    },
    {
      name: "LTCAT — TCM Engenharia",
      docType: "Laudo",
      version: 2,
      sizeBytes: 4120000,
      validUntil: "2026-01-20",
    },
    {
      name: "Ficha de EPI — Proteção Auditiva",
      docType: "Ficha",
      version: 1,
      sizeBytes: 450000,
      validUntil: null,
    },
    {
      name: "Relatório de Inspeção Anual",
      docType: "Relatório",
      version: 1,
      sizeBytes: 5200000,
      validUntil: "2027-12-01",
    },
  ];

  for (const doc of sampleDocs) {
    const docId = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    const path = `${ORG_ID}/${docId}.pdf`;
    await sql`
      insert into public.documents (
        id, org_id, document_group_id, name, doc_type, version, size_bytes, storage_path, folder_id, valid_until
      ) values (
        ${docId},
        ${ORG_ID},
        ${groupId},
        ${doc.name},
        ${doc.docType},
        ${doc.version},
        ${doc.sizeBytes},
        ${path},
        null,
        ${doc.validUntil}
      )
      on conflict do nothing;
    `;
  }

  console.log("Seed para sst-manager-development concluído com sucesso!");
  await sql.end();
}

main().catch((err) => {
  console.error("Erro ao rodar seed:", err);
  process.exit(1);
});
