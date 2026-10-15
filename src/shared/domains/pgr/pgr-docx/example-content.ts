import type { PgrDocxContent, PgrDocxMeasureLevel } from "./content";

/**
 * PGR de EXEMPLO com dados fictícios (empresa, pessoas e números inventados) — usado
 * no exemplo versionado em `templates/pgr/exemplo/` e nos testes do template. Dados
 * reais de cliente ficam fora do repositório (`docs/_local-refs/`, gitignored).
 */

const yes = (measures: string, monitoring: string): PgrDocxMeasureLevel => ({
  applies: "Sim",
  measures,
  monitoring,
});
const no = (measures: string, monitoring: string): PgrDocxMeasureLevel => ({
  applies: "Não",
  measures,
  monitoring,
});

export const PGR_DOCX_EXAMPLE_CONTENT: PgrDocxContent = {
  emittedAt: "02/10/2026 09:30",
  validity: "10/2026 a 09/2028",
  company: {
    razaoSocial: "CONSTRUTORA HORIZONTE EXEMPLO LTDA",
    nomeFantasia: "HORIZONTE EXEMPLO",
    cityState: "CAMPINAS - SP",
    address: "AV EXEMPLO, 1000 | CAMPINAS - SP",
    cnpj: "00.000.000/0001-00",
    stateRegistration: "000.000.000.000",
    phone: "(19) 0000-0000",
    cnae: "41.20-4-00 (Construção de edifícios)",
    riskGrade: "3",
  },
  workUnit: {
    name: "OBRA RESIDENCIAL JARDIM EXEMPLO",
    contractNumbers: "CT-0001/2026",
    address: "Rua das Amostras, 250 - Jardim Exemplo",
    addressCity: "Campinas - SP",
  },
  contract: {
    contractor: "INCORPORADORA MODELO S.A",
    contractorCnpj: "11.111.111/0001-11",
    number: "CT-0001/2026",
    manager: "Ana Exemplo",
    inspector: "Bruno Modelo",
    agent: "Carla Fictícia",
    agentContact: "(19) 90000-0000",
    object: "Execução de estrutura e alvenaria de edifício residencial de 8 pavimentos.",
    term: "540 dias, a partir de 01/10/2026",
    employees: "12",
    executionPlace: "Rua das Amostras, 250 - Jardim Exemplo, Campinas - SP",
  },
  responsibles: {
    author: "Diego Exemplo",
    authorRegistration: "0000000000/SP",
    coauthors: "Elisa Modelo",
    coauthorRegistration: "1111111111/SP",
    companyResponsible: "Fábio Fictício",
    registrationType: "CREA",
  },
  cipa: {
    riskGrade: "3",
    employeeCount: "12",
    effectiveMembers: "1",
    alternateMembers: "1",
  },
  revisions: [
    {
      number: "00",
      date: "01-10-2026",
      validUntil: "30-09-2028",
      description: "00 - Emissão inicial",
      responsible: "Engenheiro de Segurança do Trabalho Diego Exemplo",
    },
  ],
  jobRoles: [
    {
      name: "ENCARREGADO DE OBRAS",
      description:
        "Coordenar as equipes de campo, distribuir tarefas, conferir a execução dos serviços e zelar pelo cumprimento dos procedimentos de segurança.",
      workload: "07h00min – 17h00min (Segunda a Sexta-feira); Intervalo: 01h00min",
      employeeCount: "1",
    },
    {
      name: "PEDREIRO",
      description:
        "Executar alvenarias, revestimentos e concretagens, preparar argamassas e manter a organização da frente de trabalho.",
      workload: "07h00min – 17h00min (Segunda a Sexta-feira); Intervalo: 01h00min",
      employeeCount: "6",
    },
    {
      name: "SERVENTE",
      description:
        "Auxiliar os oficiais no transporte de materiais, limpeza do canteiro e preparo de massas.",
      workload: "07h00min – 17h00min (Segunda a Sexta-feira); Intervalo: 01h00min",
      employeeCount: "4",
    },
    {
      name: "TÉCNICO DE SEGURANÇA DO TRABALHO",
      description:
        "Inspecionar as frentes de trabalho, conduzir DDS, controlar a entrega de EPI e acompanhar o plano de ação do PGR.",
      workload: "07h00min – 17h00min (Segunda a Sexta-feira); Intervalo: 01h00min",
      employeeCount: "1",
    },
  ],
  jobRolesTotal: "12",
  trainingMatrix: {
    columns: ["NR 06", "NR 18", "NR 35", "NR 12"],
    rows: [
      { name: "ENCARREGADO DE OBRAS", marks: [true, true, true, false] },
      { name: "PEDREIRO", marks: [true, true, true, false] },
      { name: "SERVENTE", marks: [true, true, false, false] },
      { name: "TÉCNICO DE SEGURANÇA DO TRABALHO", marks: [true, true, true, true] },
    ],
  },
  ges: [
    {
      title: "GES 01 - ADMINISTRATIVO DO CANTEIRO",
      processDescription:
        "Atividades administrativas e de coordenação da obra realizadas no contêiner de escritório: planejamento, controle de documentos, compras e acompanhamento de equipes.",
      construction: {
        buildingType: "Contêiner",
        ceilingHeight: "2,5",
        floor: "Madeira",
        roof: "Metálica",
        lighting: "LED",
        ventilation: "Ambiente climatizado",
        other: "",
      },
      jobRoles: [
        { name: "ENCARREGADO DE OBRAS", description: "" },
        { name: "TÉCNICO DE SEGURANÇA DO TRABALHO", description: "" },
      ],
      risks: [
        {
          number: 1,
          agentType: "Ergonômico",
          agentKey: "ergonomic",
          riskLevel: "Tolerável (3-8)",
          riskClass: "tolerable",
          hazard: "Permanência prolongada sentado",
          risk: "Postura inadequada prolongada",
          sources: "Estação de trabalho e atividades contínuas em computador",
          propagation: "Não aplicável",
          exposureTime: "4 a 7 h/turno de 8h ou 20 a 35 h/sem",
          injuries: "Lombalgias, dores musculares, fadiga",
          criterion: "Qualitativo",
          esocialCode: "Não informado",
          unitLabel: "GRUPO DE RISCO ERGONÔMICO:",
          unitValue: "Não informado",
          uncertainty: "0 - Certa",
          probability: "2 - Controle em conformidade legal",
          severity: "2 - Lesão ou doenças sérias reversíveis",
          controlNeed: "Nenhum controle adicional necessário",
          result: "",
          toleranceLimit: "",
        },
      ],
      measures: [
        {
          riskLabel: "RISCO 1",
          riskName: "Postura inadequada prolongada",
          elimination: no("Parcialmente", "Avaliação ergonômica periódica"),
          collective: yes(
            "Mobiliário ergonômico ajustável",
            "Avaliação ergonômica periódica",
          ),
          administrative: yes(
            "Pausas regulares e orientação postural",
            "Avaliação ergonômica periódica",
          ),
          individual: no("Não aplicável", "Avaliação ergonômica periódica"),
        },
      ],
      epis: [],
      actions: [
        {
          riskRef: "Risco 1",
          occupationalRisk: "Postura inadequada prolongada",
          riskLevel: "Tolerável (3-8)",
          action:
            "Implantar programa de ginástica laboral com sessões diárias de 15 minutos.",
          tracking:
            "Registro diário de participação e feedback mensal dos colaboradores.",
          measurement:
            "Redução das queixas de dor registradas no questionário trimestral.",
          responsible: "SESMT",
          deadline: "30-03-2027",
          status: "Programado",
        },
      ],
    },
    {
      title: "GES 02 - ESTRUTURA E ALVENARIA",
      processDescription:
        "Execução de fôrmas, armação, concretagem e alvenaria nos pavimentos do edifício, com trabalho em altura na periferia das lajes.",
      construction: {
        buildingType: "Área aberta / edificação em construção",
        ceilingHeight: "Não aplicável",
        floor: "Concreto",
        roof: "Sem cobertura",
        lighting: "Natural",
        ventilation: "Natural",
        other: "Bandejas de proteção periférica instaladas.",
      },
      jobRoles: [
        { name: "PEDREIRO", description: "" },
        { name: "SERVENTE", description: "" },
      ],
      risks: [
        {
          number: 1,
          agentType: "Mecânicos/Acidentes",
          agentKey: "accident",
          riskLevel: "Substancial (10-15)",
          riskClass: "substantial",
          hazard: "Trabalho em altura na periferia das lajes",
          risk: "Queda de diferente nível",
          sources: "Bordas de laje, aberturas no piso e andaimes",
          propagation: "Não aplicável",
          exposureTime: "> 7 h/turno de 8h ou > 35 h/sem",
          injuries: "Fraturas, traumatismos, óbito",
          criterion: "Qualitativo",
          esocialCode: "Não informado",
          unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
          unitValue: "0 - Não aplicável",
          uncertainty: "0 - Certa",
          probability: "3 - Controle com pequenas deficiências",
          severity: "4 - Lesão ou doença incapacitante ou mortal",
          controlNeed: "Controle necessário",
          result: "",
          toleranceLimit: "",
        },
        {
          number: 2,
          agentType: "Físico",
          agentKey: "physical",
          riskLevel: "Moderado (4-12)",
          riskClass: "moderate",
          hazard: "RUÍDO",
          risk: "Exposição ao ruído de betoneira e serra circular",
          sources: "Betoneira, serra circular e vibrador de concreto",
          propagation: "Ar",
          exposureTime: "4 a 7 h/turno de 8h ou 20 a 35 h/sem",
          injuries: "Perda auditiva induzida por ruído, zumbido, irritabilidade",
          criterion: "Quantitativo",
          esocialCode: "02.01.001 - Ruído",
          unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
          unitValue: "4 - decibel (A) (dB(A))",
          uncertainty: "1 - Incerta",
          probability: "3 - Exposição moderada",
          severity: "2 - Lesão ou doenças sérias reversíveis",
          controlNeed: "Informação adicional necessária",
          result: "83,4 dB(A)",
          toleranceLimit: "85 dB(A)",
        },
      ],
      measures: [
        {
          riskLabel: "RISCO 1",
          riskName: "Queda de diferente nível",
          elimination: no(
            "Atividade inerente à execução da estrutura",
            "Inspeções diárias",
          ),
          collective: yes(
            "Guarda-corpo, rodapé e bandejas de proteção",
            "Inspeções diárias",
          ),
          administrative: yes(
            "Permissão de trabalho e treinamento NR 35",
            "Inspeções diárias",
          ),
          individual: yes("Cinto paraquedista com talabarte duplo", "Inspeções diárias"),
        },
        {
          riskLabel: "RISCO 2",
          riskName: "Exposição ao ruído",
          elimination: no("Equipamentos necessários à atividade", "Dosimetria semestral"),
          collective: yes(
            "Manutenção preventiva e enclausuramento da serra",
            "Dosimetria semestral",
          ),
          administrative: yes("Rodízio de operadores", "Dosimetria semestral"),
          individual: yes("Protetor auditivo tipo plug", "Dosimetria semestral"),
        },
      ],
      epis: [
        {
          riskRef: "RISCO 1",
          hazard: "Trabalho em altura na periferia das lajes",
          epi: "CINTO DE SEGURANÇA TIPO PARAQUEDISTA",
          ca: "00001",
          neutralizes: "Sim",
        },
        {
          riskRef: "RISCO 2",
          hazard: "RUÍDO",
          epi: "PROTETOR AUDITIVO TIPO PLUG",
          ca: "00002",
          neutralizes: "Sim",
        },
      ],
      actions: [
        {
          riskRef: "Risco 1",
          occupationalRisk: "Queda de diferente nível",
          riskLevel: "Substancial (10-15)",
          action:
            "Instalar linha de vida horizontal em todos os pavimentos antes da desforma.",
          tracking: "Checklist semanal de proteções coletivas por pavimento.",
          measurement:
            "Zero ocorrência de trabalho em altura sem ancoragem nas auditorias mensais.",
          responsible: "Engenharia da obra",
          deadline: "15-11-2026",
          status: "Em andamento",
        },
        {
          riskRef: "Risco 2",
          occupationalRisk: "Exposição ao ruído",
          riskLevel: "Moderado (4-12)",
          action: "Realizar dosimetria de ruído por função e emitir laudo.",
          tracking: "Cronograma de avaliações ambientais do SESMT.",
          measurement: "Laudo emitido e medidas revisadas conforme resultado.",
          responsible: "SESMT",
          deadline: "30-12-2026",
          status: "Programado",
        },
      ],
    },
  ],
};
