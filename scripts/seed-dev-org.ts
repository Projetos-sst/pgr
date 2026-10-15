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
    values (${ORG_ID}, 'pgr-e-development', 'pgr-e-development', 'pro')
    on conflict (id) do update set name = 'pgr-e-development', plan = 'pro';
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

  // Insert Risks across all 5 agent types with varied severity and probability
  const risksData = [
    // GES 1: Operadores de Prensa e Usinagem
    {
      gesId: ges1,
      type: "physical",
      desc: "Ruído contínuo de prensas e compressores (89 dB)",
      prob: 5,
      sev: 4,
      res: "intolerable",
      hazard: "Perda auditiva induzida por ruído (PAIR)",
      sources: "Prensas mecânicas e compressores pneumáticos",
      propagation: "Aérea",
      exposureTime: "intermittent",
      injuries: "Hipoacusia, estresse e fadiga auditiva",
      noxiousCode: "01.01.001",
      unit: "db_a",
      intensity: "89.4",
      actionWhat: "Enclausuramento acústico parcial das prensas e protetor auricular",
      actionHow: "Instalação de barreiras fônicas e fornecimento de EPI tipo concha",
      actionTracking: "Dosimetria anual de ruído",
      actionMeasurement: "Medição de pressão sonora segundo NHO 01",
      actionResp: "Eng. Roberto Mendes - SST",
      actionDeadline: "2026-09-30",
    },
    {
      gesId: ges1,
      type: "chemical",
      desc: "Poeira mineral e névoas de óleo solúvel",
      prob: 4,
      sev: 3,
      res: "moderate",
      hazard: "Inalação de aerodispersóides e óleo de usinagem",
      sources: "Usinagem de peças e serras de fita",
      propagation: "Aérea",
      exposureTime: "habitual",
      injuries: "Dermatite de contato e irritação das vias aéreas",
      noxiousCode: "02.01.015",
      unit: "mg_m3",
      intensity: "3.2",
      actionWhat: "Sistema de exaustão localizada e máscaras PFF2",
      actionHow: "Manutenção do sistema de filtração de ar",
      actionTracking: "Avaliação quantitativa semestral",
      actionMeasurement: "Amostragem gravimétrica",
      actionResp: "Técnico Lucas Silva",
      actionDeadline: "2026-10-15",
    },
    {
      gesId: ges1,
      type: "ergonomic",
      desc: "Levantamento e transporte manual de matrizes pesadas",
      prob: 3,
      sev: 4,
      res: "moderate",
      hazard: "Sobrecarga biomecânica da coluna lombar",
      sources: "Troca de ferramentas e matrizes na prensa",
      propagation: "Direta",
      exposureTime: "intermittent",
      injuries: "Lombalgia e lesões por esforço repetitivo (LER/DORT)",
      noxiousCode: null,
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Aquisição de talha elétrica móvel para movimentação",
      actionHow: "Instalação de braço articulado e suporte mecânico",
      actionTracking: "Análise Ergonômica do Trabalho (AET)",
      actionMeasurement: "Critério de Moore-Garg e NIOSH",
      actionResp: "Fisioterapeuta Dra. Paula Souza",
      actionDeadline: "2026-08-20",
    },
    {
      gesId: ges1,
      type: "accident",
      desc: "Risco de prensamento e esmagamento de membros em prensas",
      prob: 4,
      sev: 4,
      res: "substantial",
      hazard: "Partes móveis sem proteção adequada (NR-12)",
      sources: "Prensas hidráulicas e mecânicas",
      propagation: "Contato mecânico direto",
      exposureTime: "habitual",
      injuries: "Amputação, esmagamento e fraturas de membros",
      noxiousCode: null,
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Instalação de cortinas de luz e comando bimanual",
      actionHow: "Adequação do painel de segurança da prensa conforme NR-12",
      actionTracking: "Checklist diário de segurança da máquina",
      actionMeasurement: "Teste semanal de paragem de emergência",
      actionResp: "Eng. Eletricista Marcos Lima",
      actionDeadline: "2026-07-30",
    },

    // GES 2: Técnicos de Manutenção Elétrica
    {
      gesId: ges2,
      type: "accident",
      desc: "Choque elétrico e arco elétrico em painéis de alta tensão",
      prob: 3,
      sev: 5,
      res: "substantial",
      hazard: "Energia elétrica de alta voltagem e subestação",
      sources: "Painéis de distribuição de 13.8 kV",
      propagation: "Direta / Arco elétrico",
      exposureTime: "intermittent",
      injuries: "Queimaduras graves de 3º grau, parada cardiorrespiratória",
      noxiousCode: null,
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Vestimenta de proteção contra arco elétrico (ATP 4) e LOTO",
      actionHow: "Implantação do procedimento Lockout / Tagout e treinamento NR-10",
      actionTracking: "Auditoria de permissão de trabalho (PT)",
      actionMeasurement: "Inspeção visual de EPIs e ferramentas isoladas",
      actionResp: "Eng. Elétrica Carlos Silva",
      actionDeadline: "2026-06-30",
    },
    {
      gesId: ges2,
      type: "physical",
      desc: "Vibração de corpo inteiro em plataformas de manutenção",
      prob: 3,
      sev: 2,
      res: "tolerable",
      hazard: "Vibração mecânica de piso",
      sources: "Plataformas elevatórias a diesel",
      propagation: "Estrutural",
      exposureTime: "intermittent",
      injuries: "Desconforto muscular e fadiga",
      noxiousCode: "01.02.001",
      unit: "m_s2",
      intensity: "0.45",
      actionWhat: "Amortecedores nas plataformas de trabalho",
      actionHow: "Substituição dos coxins de borracha do equipamento",
      actionTracking: "Aferição periódica de VDN",
      actionMeasurement: "Aceleração conforme NHO 09",
      actionResp: "Técnico Lucas Silva",
      actionDeadline: "2026-11-30",
    },
    {
      gesId: ges2,
      type: "ergonomic",
      desc: "Trabalho em posturas incômodas durante manutenção de painéis",
      prob: 2,
      sev: 2,
      res: "trivial",
      hazard: "Posição curvada constante",
      sources: "Quadros de comando baixos",
      propagation: "Direta",
      exposureTime: "eventual",
      injuries: "Dores musculares temporárias",
      noxiousCode: null,
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Bancos ergonômicos e suportes ajustáveis de elevação",
      actionHow: "Disponibilizar banquetas reguláveis no almoxarifado",
      actionTracking: "Feedback dos técnicos",
      actionMeasurement: "Avaliação qualitativa AET",
      actionResp: "Fisioterapeuta Dra. Paula Souza",
      actionDeadline: "2026-12-15",
    },

    // GES 3: Equipe de Alvenaria e Estrutura
    {
      gesId: ges3,
      type: "accident",
      desc: "Queda de pessoas com diferença de nível (Andaimes / Lajes)",
      prob: 4,
      sev: 4,
      res: "substantial",
      hazard: "Trabalho em altura acima de 2 metros (NR-35)",
      sources: "Andaimes fachadeiros e periferia de laje",
      propagation: "Gravitacional",
      exposureTime: "intermittent",
      injuries: "Politraumatismo, fraturas e risco de morte",
      noxiousCode: null,
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Cinto de segurança tipo paraquedista com duplo talabarte",
      actionHow: "Linha de vida vertical/horizontal e guarda-corpo rígido",
      actionTracking: "Inspeção diária dos pontos de ancoragem",
      actionMeasurement: "Checklist NR-35 pré-jornada",
      actionResp: "Eng. Civil Fernando Alencar",
      actionDeadline: "2026-07-10",
    },
    {
      gesId: ges3,
      type: "chemical",
      desc: "Poeira de cimento e sílica livre cristalizada",
      prob: 3,
      sev: 3,
      res: "moderate",
      hazard: "Inalação de pó de sílica e cimento seco",
      sources: "Corte de tijolos, preparo de argamassa e lixamento",
      propagation: "Aérea",
      exposureTime: "intermittent",
      injuries: "Silicose e afecções respiratórias",
      noxiousCode: "02.01.020",
      unit: "mg_m3",
      intensity: "0.08",
      actionWhat: "Umidificação do corte e uso de respirador PFF2 com válvula",
      actionHow: "Acoplamento de água na cortadora e fornecimento de EPI",
      actionTracking: "Coleta quantitativa de poeira respirável",
      actionMeasurement: "NHO 08 gravimetria",
      actionResp: "Técnico Lucas Silva",
      actionDeadline: "2026-09-15",
    },
    {
      gesId: ges3,
      type: "physical",
      desc: "Radiação não ionizante (Exposição solar direta)",
      prob: 2,
      sev: 1,
      res: "trivial",
      hazard: "Raios ultravioleta solares (UV)",
      sources: "Sol durante trabalho em ambiente aberto",
      propagation: "Radiativa",
      exposureTime: "habitual",
      injuries: "Queimaduras solares e envelhecimento precoce da pele",
      noxiousCode: "01.04.001",
      unit: "qualitative_na",
      intensity: null,
      actionWhat: "Fornecimento de protetor solar FPS 50 e chapéu touca árabe",
      actionHow: "Distribuição individual de filtro solar no início do mês",
      actionTracking: "Verificação de uso em campo",
      actionMeasurement: "Inspeção de SST",
      actionResp: "Técnico Lucas Silva",
      actionDeadline: "2026-06-01",
    },
  ];

  for (const r of risksData) {
    const rId = crypto.randomUUID();
    await sql`
      insert into public.risks (
        id, org_id, ges_id, agent_type, description, hazard, sources, propagation, exposure_time, possible_injuries, noxious_agent_code, measurement_unit, concentration_intensity
      ) values (
        ${rId},
        ${ORG_ID},
        ${r.gesId},
        ${r.type},
        ${r.desc},
        ${r.hazard},
        ${r.sources},
        ${r.propagation},
        ${r.exposureTime},
        ${r.injuries},
        ${r.noxiousCode},
        ${r.unit},
        ${r.intensity}
      )
      on conflict do nothing;
    `;

    // Risk Assessment
    const raId = crypto.randomUUID();
    const riskLevel = r.prob * r.sev;
    await sql`
      insert into public.risk_assessments (
        id, org_id, risk_id, criterion, probability, severity, risk_level, result, assessed_at
      ) values (
        ${raId},
        ${ORG_ID},
        ${rId},
        'qualitative',
        ${r.prob},
        ${r.sev},
        ${riskLevel},
        ${r.res},
        '2026-01-20'
      )
      on conflict do nothing;
    `;

    // Control Measure 5W2H
    const cmId = crypto.randomUUID();
    const level =
      r.type === "physical"
        ? "collective_protection"
        : r.type === "chemical"
          ? "administrative"
          : "ppe";
    await sql`
      insert into public.control_measures (
        id, org_id, risk_id, control_level, applicable, action_what, action_how, action_tracking, action_measurement, action_responsible, action_deadline
      ) values (
        ${cmId},
        ${ORG_ID},
        ${rId},
        ${level},
        true,
        ${r.actionWhat},
        ${r.actionHow},
        ${r.actionTracking},
        ${r.actionMeasurement},
        ${r.actionResp},
        ${r.actionDeadline}
      )
      on conflict do nothing;
    `;

    // Link EPI if relevant
    if (r.type === "physical" || r.type === "chemical" || r.type === "accident") {
      const epiId = r.type === "physical" ? epiCat1 : epiCat2;
      const epiRiskId = crypto.randomUUID();
      await sql`
        insert into public.epi_risk (id, org_id, catalog_id, risk_id, neutralization)
        values (${epiRiskId}, ${ORG_ID}, ${epiId}, ${rId}, 'neutralizes')
        on conflict do nothing;
      `;
    }
  }

  // Insert Document PGR (Programa de Gerenciamento de Riscos)
  const pgrId = crypto.randomUUID();
  await sql`
    insert into public.pgr (
      id, org_id, company_id, work_unit_id, responsible, registration_type, registration_number, issued_at, valid_until
    ) values (
      ${pgrId},
      ${ORG_ID},
      ${compId},
      ${wu1},
      'Eng. Carlos Eduardo da Silva (CREA 5069248231)',
      'crea',
      '5069248231/D',
      '2026-01-15',
      '2027-01-15'
    )
    on conflict do nothing;
  `;

  // Fetch or link PGR to GES (n:n)
  const pgrList = await sql`select id from public.pgr where org_id = ${ORG_ID}`;
  const targetPgrId = pgrList.length > 0 ? pgrList[0].id : pgrId;

  await sql`
    insert into public.pgr_ges (id, org_id, pgr_id, ges_id)
    values
      (${crypto.randomUUID()}, ${ORG_ID}, ${targetPgrId}, ${ges1}),
      (${crypto.randomUUID()}, ${ORG_ID}, ${targetPgrId}, ${ges2}),
      (${crypto.randomUUID()}, ${ORG_ID}, ${targetPgrId}, ${ges3})
    on conflict do nothing;
  `;

  // Insert PGR Revisions
  await sql`
    insert into public.pgr_revisions (id, org_id, pgr_id, revision_number, revised_at, notes)
    values
      (${crypto.randomUUID()}, ${ORG_ID}, ${targetPgrId}, 1, '2026-01-15', 'Elaboração inicial do Programa de Gerenciamento de Riscos (NR-01 / GRO)'),
      (${crypto.randomUUID()}, ${ORG_ID}, ${targetPgrId}, 2, '2026-04-10', 'Revisão periódica de acompanhamento e inclusão de novas matrizes na prensa')
    on conflict do nothing;
  `;

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

  console.log("Seed para pgr-e-development concluído com sucesso!");
  await sql.end();
}

main().catch((err) => {
  console.error("Erro ao rodar seed:", err);
  process.exit(1);
});
