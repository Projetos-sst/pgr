/**
 * Valores DEFAULT das partes SEMI-FIXAS do PGR (marcação laranja no PGR 2026.1):
 * rótulos, títulos de seção, textos normativos e o cronograma de campanhas. O
 * template só tem o placeholder; o texto vem daqui e pode ser trocado por PGR
 * (overrides). Transcritos do PGR 2026 de referência e generalizados com tokens:
 *
 * - `{empresa}` razão social · `{grauRisco}` grau de risco · `{numeroEmpregados}`
 * - `{cipaTitulares}` / `{cipaSuplentes}` composição · `{cipaHorasTreinamento}`
 * - `{anosVigencia}` ("2026–2028", derivado da vigência)
 *
 * Partes FIXAS (amarelo) ficam literais no template; partes DINÂMICAS (sem marcação)
 * vêm do banco — ver `marker-catalog.ts`.
 */

/** Parágrafo de texto rico. `**trecho**` vira negrito. */
export type RichBlock = {
  kind: "paragraph" | "item" | "subtitle";
  text: string;
};

const p = (text: string): RichBlock => ({ kind: "paragraph", text });
const item = (text: string): RichBlock => ({ kind: "item", text });
const sub = (text: string): RichBlock => ({ kind: "subtitle", text });

export const DEFAULT_LABELS = {
  documentTitle: "PGR",
  documentSubtitle: "Programa de Gerenciamento de Riscos",
  headerTitle: "PROGRAMA DE GERENCIAMENTO DE RISCOS",
  inventoryHeaderTitle: "INVENTÁRIO DE RISCOS",
  validity: "VIGÊNCIA:",
  contract: "CONTRATO:",
  employerSection: "EMPREGADOR",
  company: "Empresa:",
  address: "Endereço:",
  cnpj: "CNPJ:",
  stateRegistration: "Inscrição Estadual:",
  phone: "Telefone:",
  cnae: "CNAE:",
  riskGrade: "Grau de Risco:",
  workUnitSection: "UNIDADE DE OBRA / LOCAL",
  workUnit: "Local / Obra:",
  workUnitContract: "Contrato:",
  contractDescription: "Objeto do Contrato / Descrição:",
  contractor: "Contratante:",
  contractorCnpj: "CNPJ:",
  contractNumber: "Número do contrato:",
  contractManager: "Gestor do Contrato:",
  contractInspector: "Fiscal do Contrato:",
  contractAgent: "Preposto do Contrato:",
  contractAgentContact: "e-mail:",
  contractObject: "Objeto do Contrato:",
  contractTerm: "Vigência:",
  contractEmployees: "Número de Empregados:",
  executionPlace: "Local da Execução do Trabalho:",
  workUnitAddress: "Endereço do Local:",
  responsiblesSection: "RESPONSÁVEL PELA ELABORAÇÃO E RESPONSÁVEL PELA EMPRESA",
  author: "Autor:",
  coauthors: "Coautor(es):",
  registration: "Registro:",
  companyResponsible: "Responsável da empresa:",
  registrationType: "Tipo de registro:",
  revisionSection: "REVISÃO",
  revisionNumber: "Revisão",
  revisionDate: "Data",
  revisionValidUntil: "Validade",
  revisionDescription: "Descrição das alterações",
  revisionResponsible: "Responsável pelas alterações",
  summary: "SUMÁRIO",
  jobRoleName: "Função",
  jobRoleDescription: "Descrição das atividades",
  jobRoleWorkload: "Carga horária",
  jobRoleCount: "Qtd. funcionários",
  jobRolesTotal: "TOTAL DE FUNCIONÁRIOS:",
  trainingIndex: "Nº",
  trainingRole: "FUNÇÃO",
  classificationTable:
    "Classificação dos Principais Riscos Ocupacionais em Grupos, de acordo com a sua natureza e padronização das cores correspondentes.",
  classificationTableErgonomic:
    "Classificação dos Principais Riscos Ocupacionais como Ergonômico e Acidente.",
  probabilityQuantTable: "GRADAÇÃO DE PROBABILIDADE — AVALIAÇÕES QUANTITATIVAS",
  probabilityQualTable: "GRADAÇÃO DE PROBABILIDADE — AVALIAÇÕES QUALITATIVAS",
  severityTable: "GRADAÇÃO DE SEVERIDADE — AVALIAÇÕES QUANTITATIVAS/QUALITATIVAS",
  riskMatrixTable: "MATRIZ DE RISCO 5X5",
  controlNeedTable: "NECESSIDADE DE CONTROLES E INFORMAÇÕES",
  methodologyLevel: "Nível",
  methodologyCategory: "Categoria",
  methodologyExposure: "Níveis de Exposição",
  methodologyControl: "Controle Existente",
  methodologyPrevention: "Medidas de Prevenção",
  methodologyDefinition: "Definição",
  matrixProbability: "PROBABILIDADE",
  matrixSeverity: "SEVERIDADE",
  matrixLegend: "Legenda do Nível de Risco",
  controlNeedPriority: "NÍVEIS DE RISCOS (Ordem de Prioridade)",
  controlNeedUncertainty: "Incerteza da Estimativa",
  controlNeedCertain: "0 - Certa",
  controlNeedUncertain: "1 - Incerta",
  controlNeedHighlyUncertain: "2 - Altamente Incerta",
  trainingMatrixEmpty: "Nenhum treinamento obrigatório vinculado às funções deste PGR.",
  sanitaryFacilities: "Instalações Sanitárias",
  foodArea: "Local para Alimentação",
  drinkingWater: "Água Potável",
  supportFacilities: "Gestão das Instalações de Apoio",
  campaignMonth: "Campanha",
  campaignTheme: "Tema",
  campaignActions: "Ações recomendadas",
} as const;

export type PgrDocxLabelKey = keyof typeof DEFAULT_LABELS;

export const DEFAULT_TITLES = {
  introduction: "1 - INTRODUÇÃO",
  objective: "2 - OBJETIVO DO PGR",
  responsibilities: "3 - RESPONSABILIDADES",
  jobRoles: "4 - QUADRO DE FUNÇÕES",
  trainingMatrix: "5 - MATRIZ DE TREINAMENTO: APLICABILIDADE POR FUNÇÃO",
  epi: "6 - EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL",
  strategy: "7 - ESTRATÉGIA E METODOLOGIA DE AÇÃO",
  records: "8 - REGISTRO, MANUTENÇÃO E DIVULGAÇÃO DOS DADOS",
  periodicity: "9 - PERIODICIDADE E FORMA DE AVALIAÇÃO DO DESENVOLVIMENTO DO PGR",
  identification: "10 - IDENTIFICAÇÃO E RECONHECIMENTO DOS AGENTES AMBIENTAIS",
  actionLevel: "11 - DO NÍVEL DE AÇÃO",
  cipa: "12 - COMISSÃO INTERNA DE PREVENÇÃO DE ACIDENTES E DE ASSÉDIO – CIPAA",
  fieldRecord: "13 - REGISTRO DE CAMPO",
  psychosocial: "14 - GERENCIAMENTO DOS FATORES DE RISCO PSICOSSOCIAIS",
  classification: "15 - CLASSIFICAÇÃO DOS RISCOS AMBIENTAIS",
  communication: "16 - COMUNICAÇÃO, PARTICIPAÇÃO E CONSCIENTIZAÇÃO DOS TRABALHADORES",
  riskCategory: "17 - CATEGORIA DO NÍVEL DE RISCO",
  methodology: "18 - ESTABELECIMENTO E PROCEDIMENTO DA METODOLOGIA DA AVALIAÇÃO",
  emergency: "19 - PREPARAÇÃO PARA EMERGÊNCIAS",
  gesStructure: "20 - ESTRUTURAÇÃO DOS GRUPOS DE EXPOSIÇÃO SIMILAR – GES",
  sanitary: "21 - CONDIÇÕES SANITÁRIAS E DE CONFORTO (NR 24)",
  healthSchedule:
    "22 - CRONOGRAMA ANUAL DE AÇÕES DE PREVENÇÃO E PROMOÇÃO DA SAÚDE DO TRABALHADOR",
  annexSchedule:
    "23 - Anexo I – Cronograma de Implementação e Acompanhamento do PGR ({anosVigencia})",
  finalProvisions: "24 - DISPOSIÇÕES FINAIS",
} as const;

export type PgrDocxTitleKey = keyof typeof DEFAULT_TITLES;

/** Ordem das seções no sumário (o sumário é derivado dos títulos — editar um título atualiza o sumário). */
export const SUMMARY_ORDER: PgrDocxTitleKey[] = Object.keys(
  DEFAULT_TITLES,
) as PgrDocxTitleKey[];

export const RISK_MATRIX_ASYMMETRY_NOTE = p(
  "**Obs.:** suponha-se que os valores fossem invertidos (severidade 3 e probabilidade 2), o nível do risco ainda seria 6 (3x2), porém o nível do risco seria tolerável (6), ao invés de Moderado (6). Isso se deve ao fato de a severidade ter maior relevância ao se definir o nível de risco.",
);

export const DEFAULT_TEXTS = {
  introduction: [
    p(
      "{empresa}, objetivando a manutenção das condições de Segurança no Trabalho a que estão sujeitos seus colaboradores, apresenta o PGR. O Programa de Gerenciamento de Riscos da organização foi elaborado conforme diretrizes estabelecidas na Norma Regulamentadora nº 01, da Portaria 3214/78, do Ministério do Trabalho, revisada pela Portaria SEPRT n.º 6.730, de 09 de março de 2020.",
    ),
  ],
  objective: [
    p(
      "O PGR tem como objetivo a melhoria contínua dos seus processos, visando a prevenção e gerenciamento dos riscos ocupacionais. A organização visa com o PGR, atender aos seguintes objetivos:",
    ),
    item("a) evitar os riscos ocupacionais que possam ser originados no trabalho;"),
    item("b) identificar os perigos e possíveis lesões ou agravos à saúde;"),
    item("c) avaliar os riscos ocupacionais indicando o nível de risco;"),
    item(
      "d) classificar os riscos ocupacionais para determinar a necessidade de adoção de medidas de prevenção;",
    ),
    item(
      "e) implementar medidas de prevenção, de acordo com a classificação de risco e na ordem de prioridade estabelecida na alínea “g” do subitem 1.4.1 da NR 01;",
    ),
    item("I. eliminação dos fatores de risco;"),
    item(
      "II. minimização e controle dos fatores de risco, com a adoção de medidas de proteção coletiva;",
    ),
    item(
      "III. minimização e controle dos fatores de risco, com a adoção de medidas administrativas ou de organização do trabalho; e",
    ),
    item("IV. adoção de medidas de proteção individual."),
    item("f) acompanhar o controle dos riscos ocupacionais."),
    p(
      "O PGR é elaborado e implementado nos canteiros de obras, contemplando os riscos ocupacionais e suas respectivas medidas de prevenção, é elaborado por PH (Profissional Habilitado) em segurança do trabalho e implementado sob responsabilidade da empresa. A organização implementa, por estabelecimento, o gerenciamento de riscos ocupacionais em suas atividades (PGR). O PGR contempla e está integrado com planos, programas e outros documentos da legislação de SST.",
    ),
    p(
      "O PGR, além de contemplar as exigências previstas na NR-01, contempla os seguintes documentos:",
    ),
    item(
      "a) projeto da área de vivência do canteiro de obras e de eventual frente de trabalho, em conformidade com o item 18.5 da NR 18, elaborado por profissional legalmente habilitado;",
    ),
    item(
      "b) projeto elétrico das instalações temporárias, elaborado por profissional legalmente habilitado;",
    ),
    item(
      "c) projetos dos sistemas de proteção coletiva elaborados por profissional legalmente habilitado;",
    ),
    item(
      "d) projetos dos Sistema de Proteção Individual Contra Quedas, quando aplicável, elaborados por PH;",
    ),
    item(
      "e) relação dos EPIs e suas respectivas especificações técnicas, de acordo com os riscos ocupacionais existentes.",
    ),
    p(
      "O PGR está atualizado de acordo com a etapa em que se encontra o canteiro de obras e considera as frentes de trabalho.",
    ),
  ],
  responsibilities: [
    sub("Alta Direção"),
    p(
      "A diretoria garantirá apoio e recursos para que o ambiente de trabalho de seus colaboradores da empresa esteja em sintonia com os padrões exigidos pelas normas vigentes no país, assim se comprometendo com o apoio e recursos para a implantação e cumprimentos dos objetivos do gerenciamento de riscos ocupacionais.",
    ),
    p(
      "A Diretoria deverá designar o setor que ficará responsável pela implantação do PGR, o qual deverá ser responsável pela avaliação dos riscos através de um processo contínuo a ser revista a cada dois anos ou quando da ocorrência das seguintes situações:",
    ),
    item(
      "a) após implementação das medidas de prevenção, para avaliação de riscos residuais;",
    ),
    item(
      "b) após inovações e modificações nas tecnologias, ambientes, processos, condições, procedimentos e organização do trabalho que impliquem em novos riscos ou modifiquem os riscos existentes;",
    ),
    item(
      "c) quando identificadas inadequações, insuficiências ou ineficácias das medidas de prevenção;",
    ),
    item("d) na ocorrência de acidentes ou doenças relacionadas ao trabalho;"),
    item("e) quando houver mudança nos requisitos legais aplicáveis."),
    sub("Cabe ao empregador"),
    item(
      "a) cumprir e fazer cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho;",
    ),
    item("b) informar aos trabalhadores:"),
    item("I. os riscos ocupacionais existentes nos locais de trabalho;"),
    item(
      "II. as medidas de prevenção adotadas pela empresa para eliminar ou reduzir tais riscos;",
    ),
    item(
      "III. os resultados dos exames médicos e de exames complementares de diagnóstico aos quais os próprios trabalhadores forem submetidos;",
    ),
    item(
      "IV. os resultados das avaliações ambientais realizadas nos locais de trabalho.",
    ),
    item(
      "c) elaborar ordens de serviço sobre segurança e saúde no trabalho, dando ciência aos trabalhadores;",
    ),
    item(
      "d) permitir que representantes dos trabalhadores acompanhem a fiscalização dos preceitos legais e regulamentares sobre segurança e saúde no trabalho;",
    ),
    item(
      "e) determinar procedimentos que devem ser adotados em caso de acidente ou doença relacionada ao trabalho, incluindo a análise de suas causas;",
    ),
    item(
      "f) disponibilizar à Inspeção do Trabalho todas as informações relativas à segurança e saúde no trabalho; e",
    ),
    item(
      "g) implementar medidas de prevenção, ouvidos os trabalhadores, de acordo com a seguinte ordem de prioridade:",
    ),
    item("I. eliminação dos fatores de risco;"),
    item(
      "II. minimização e controle dos fatores de risco, com a adoção de medidas de proteção coletiva;",
    ),
    item(
      "III. minimização e controle dos fatores de risco, com a adoção de medidas administrativas ou de organização do trabalho;",
    ),
    item("IV. adoção de medidas de proteção individual."),
    sub("Compete ao SESMT (conforme NR 4 no subitem 4.3.1)"),
    item("a) elaborar ou participar da elaboração do inventário de riscos;"),
    item("b) acompanhar a implementação do plano de ação do PGR;"),
    item(
      "c) implementar medidas de prevenção de acordo com a classificação de risco do PGR e na ordem de prioridade estabelecida na NR-01;",
    ),
    item(
      "d) elaborar plano de trabalho e monitorar metas, indicadores e resultados de SST;",
    ),
    sub("Empregados"),
    item(
      "a) Cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho;",
    ),
    item("b) Submeter-se aos exames médicos previstos nas NR;"),
    item("c) Colaborar com a organização na aplicação das NR e"),
    item(
      "d) Colaborar e participar na implantação e execução do PGR e das demais Normas Regulamentadoras.",
    ),
    p(
      "**Obs.:** Constitui ato faltoso, a recusa injustificada do funcionário ao cumprimento das normas de saúde e segurança do trabalho, que ponha em risco a sua saúde ou de outrem.",
    ),
    sub("Empresas Terceirizadas"),
    p(
      "As empresas terceirizadas contratadas pela Organização deverão implementar, de forma integrada, as ações do PGR, de forma que seja garantido aos empregados o mesmo nível de proteção que os da contratante, bem como cumprir o disposto nas Normas Regulamentadoras em especial no que se refere ao PGR.",
    ),
    p(
      "Todo trabalhador, ao ser admitido ou quando mudar de função que implique em alteração de risco, deve receber informações sobre:",
    ),
    item(
      "a) os riscos ocupacionais que existam ou possam originar-se nos locais de trabalho;",
    ),
    item("b) os meios para prevenir e controlar tais riscos;"),
    item("c) as medidas adotadas pela organização;"),
    item("d) os procedimentos a serem adotados em situação de emergência; e"),
    item(
      "e) os procedimentos a serem adotados, em conformidade com os subitens 1.4.3 e 1.4.3.1. da NR01",
    ),
    p("As informações podem ser transmitidas:"),
    item("a) durante os treinamentos; e"),
    item("b) por meio de diálogos de segurança, documento físico ou eletrônico."),
  ],
  epi: [
    sub("Critérios de Fornecimento de EPI"),
    p(
      "Para que haja o fornecimento adequado de EPI, devem ser tomadas as seguintes ações preventivas:",
    ),
    item(
      "a) Verificação se o colaborador tem condições físicas, definidas pelo médico da empresa, de realizar a tarefa designada usando o EPI;",
    ),
    item(
      "b) Identificação dos riscos do ambiente de trabalho, em virtude do próprio ambiente, atividade executada, forma ou processo de trabalho existente, verificando a matéria-prima utilizada e as reações envolvidas na utilização dos produtos;",
    ),
    p(
      "Todos os colaboradores deverão ser treinados quanto ao uso, guarda e higienização dos EPI’S.",
    ),
    p(
      "Quando houver o desgaste ou danificação do EPI, deverá ser realizada troca por um novo equipamento.",
    ),
  ],
  strategy: [
    p(
      "O presente programa visa auxiliar na elaboração de objetivos coerentes, específicos, mensuráveis e úteis ao programa de melhorias do ambiente de trabalho, que objetivam evitar ou manter baixas taxas de lesões e doenças baseadas em práticas de gerenciamento.",
    ),
    p(
      "No campo da Saúde Ocupacional, os esforços devem ser prioritariamente concentrados no desenvolvimento e implementação do PGR / PCMSO.",
    ),
    p(
      "Os desenvolvimentos de programas adicionais não são recomendados antes que o escopo básico do PGR / PCMSO tenha atingido desenvolvimento satisfatório em todos os níveis organizacionais, geralmente, a taxa de adoção satisfatória é de um programa por ano.",
    ),
    p(
      "A estratégia e metodologia de ação para o desenvolvimento deste programa seguirá, no mínimo, as seguintes diretrizes:",
    ),
    item(
      "- Divulgação deste programa e suas alterações na CIPA – Comissão interna de Prevenção de Acidentes por parte do empregador;",
    ),
    item(
      "- Disponibilização deste programa e suas alterações de modo a proporcionar o imediato acesso às autoridades competentes;",
    ),
    item(
      "- Garantir a implementação de todas as atividades constantes no planejamento anual.",
    ),
  ],
  records: [
    sub("Registro"),
    p(
      "Este PGR constituirá o Programa de Gerenciamento de Risco, que é composto pelo Inventário de Riscos e o Plano de ação. O Inventário de Riscos Ocupacionais deve ser mantido atualizado, sendo que o histórico de atualizações deverá ser mantido por um período de 20 anos. Os dados da identificação dos perigos e avaliações dos riscos ocupacionais devem ser consolidados no inventário de riscos ocupacionais, conforme preconiza o subitem 1.5.7.3.1 da NR 01. O Inventário de Riscos Ocupacionais deve contemplar, no mínimo, as seguintes informações:",
    ),
    item("a) caracterização dos processos e ambientes de trabalho;"),
    item("b) caracterização das atividades;"),
    item(
      "c) descrição de perigos e de possíveis lesões ou agravos à saúde dos trabalhadores, com a identificação das fontes ou circunstâncias, descrição de riscos gerados pelos perigos, com a indicação dos grupos de trabalhadores sujeitos a esses riscos, e descrição de medidas de prevenção implementadas;",
    ),
    item(
      "d) dados da análise preliminar ou do monitoramento das exposições a agentes físicos, químicos e biológicos e os resultados da avaliação de ergonomia nos termos da NR-17;",
    ),
    item(
      "e) avaliação dos riscos, incluindo a classificação para fins de elaboração do plano de ação;",
    ),
    item("f) critérios adotados para avaliação dos riscos e tomada de decisão;"),
    item(
      "g) as medidas de prevenção e adequações decorrentes da avaliação ergonômica preliminar, atendido o previsto NR 17; e as recomendações da AET.",
    ),
    p(
      "O reconhecimento dos fatores de riscos (físico, químico, biológico, ergonômicos e de acidentes) baseia-se na identificação destes fatores existentes nos locais de trabalho, por meio das avaliações realizadas pelos profissionais da área de Segurança do Trabalho, tendo participado do inventário de riscos os TST da empresa.",
    ),
    p(
      "Com a finalidade de otimizar o reconhecimento e avaliação da exposição dos empregados em relação aos perigos/fatores de risco, são formados os Grupos de Exposição Similar (GES). Para a realização da identificação, são abrangidas:",
    ),
    item("a) Visitas aos locais de trabalho e entrevistas com os empregados;"),
    item("b) Mecanismos de sugestão dos empregados / CIPA;"),
    item("c) Auditoria interna;"),
    item("d) Auditoria externa;"),
    item(
      "e) Verificação do processo de trabalho, atividades, setores, equipamentos, agentes, dentre outros;",
    ),
    item(
      "f) Análises da documentação existente (relatórios, procedimentos operacionais, manuais, controle de EPI, treinamentos etc.);",
    ),
    item("g) os resultados da avaliação ergonômica preliminar; e"),
    item(
      "h) a revisão, quando for o caso, da identificação dos perigos e da avaliação dos riscos, conforme indicado pela AET.",
    ),
    sub("Manutenção"),
    p(
      "A avaliação periódica do andamento do programa, assim como o cumprimento das medidas de controle sugeridas, seguirá o planejamento anual e cronograma de ações com suas metas, prioridades, prazo de realização. Caso deixe de realizar alguma ação planejada, esta será reprogramada para revisão do PGR.",
    ),
    sub("Divulgação"),
    p(
      "O programa inicial e a revisão do PGR deverão estar disponíveis na unidade em posse do gestor da unidade e do SESMT, para apreciação dos empregados e da fiscalização do Ministério do Trabalho. O programa inicial e as revisões dos PGRs deverão ser arquivados por um período mínimo de 20 anos. A divulgação de dados será realizada mediante palestras, treinamentos, reuniões, boletins internos, Treinamento Admissional, dentre outros.",
    ),
  ],
  periodicity: [
    p(
      "Os esforços devem ser dirigidos para a manutenção e aperfeiçoamento dos programas de segurança e saúde ocupacional existente, e desenvolvimento de novos quando necessário.",
    ),
    p(
      "Normalmente, itens associados à manutenção dos programas existentes não fazem parte dos objetivos, todavia, a revisão destes programas e o desenvolvimento de novos, têm seu progresso assegurado quando inclusos nos objetivos estabelecidos.",
    ),
    p(
      "As modificações nos programas existentes ou empreendimento de novos programas deverão ser baseadas em:",
    ),
    item("a) Atualização dos fundamentos de segurança e saúde ocupacional;"),
    item(
      "b) Identificação de incompatibilidade, inaplicabilidade ou deficiências do atual programa.",
    ),
    p(
      "A unidade deverá realizar anualmente uma análise global do PGR. Com a mesma periodicidade deverá ser elaborado o relatório anual do PCMSO. A análise integrada desses indicadores deverá ser considerada para estabelecer o plano de ação para o ano seguinte, realizando-se os ajustes necessários à continuidade das ações preventivas.",
    ),
    p(
      "O PGR será revisado sempre que houver projetos de novas instalações, métodos ou processos de trabalho, ou de modificação dos já existentes. Visando identificar os riscos potenciais e introduzir medidas de proteção para sua redução ou eliminação, e pelo menos uma vez ao ano com objetivo de avaliar o seu desenvolvimento e realizar os ajustes necessários, assim como o monitoramento ou reavaliação para verificação da eficácia das medidas de controle implementadas.",
    ),
  ],
  identification: [
    p(
      "Consiste no levantamento das Áreas/Postos de Trabalho, com a finalidade de identificar os métodos e processos de trabalho em questão, as operações de rotina, intermitentes e eventuais, situações e horários críticos, os agentes ambientais existentes e a exposição dos trabalhadores a estes agentes, a existência de proteções individuais e coletivas, a adequação destes equipamentos de proteção e a interação dessas variáveis com os agentes ambientais verificados. O Reconhecimento envolve a identificação e a explicitação dos riscos existentes nos ambientes de trabalho do empreendimento. As informações necessárias nesta etapa são:",
    ),
    item("- A determinação e a localização das possíveis fontes geradoras;"),
    item("- As trajetórias e os meios de propagação;"),
    item("- A caracterização das atividades e do tipo de exposição;"),
    item(
      "- A identificação das funções e a determinação do número de trabalhadores expostos aos riscos;",
    ),
    item(
      "- A obtenção dos dados existentes no empreendimento que sejam indicativos de possível comprometimento da Saúde, em decorrência do trabalho; possíveis danos à Saúde, relacionados aos riscos identificados, disponíveis na Literatura Técnica. A descrição das medidas de controle já existentes no empreendimento e das possíveis alterações que aumentem a sua eficiência na redução ou eliminação dos riscos ambientais;",
    ),
    item(
      "- A avaliação é a etapa que abrange o monitoramento dos riscos ambientais, para que sejam determinadas a intensidade dos agentes físicos, a concentração dos agentes químicos e a mensuração dos agentes biológicos;",
    ),
    item(
      "- A identificação reconhecimento dos agentes ambientais se fez necessária tendo em vista o desenvolvimento das atividades dos colaboradores em ambientes com exposição a agentes nocivos (poeira, ruído e calor). Esta etapa se fez necessária também para identificar o tipo de exposição e planejamento das avaliações quantitativas.",
    ),
    item(
      "- {empresa} estabelece os requisitos para a avaliação das exposições ocupacionais a agentes físicos, químicos e biológicos quando identificados no Programa de Gerenciamento de Riscos - PGR.",
    ),
    p(
      "A avaliação de riscos deve constituir um processo contínuo e ser revista a cada 2 anos ou quando ocorrer as situações previstas no subitem 1.5.4.4.6 da NR -01.",
    ),
  ],
  actionLevel: [
    p(
      "Para os fins de atendimento a esta NR consideraremos os níveis de ação o valor acima do qual devem ser iniciadas ações preventivas de forma a minimizar a probabilidade de que as exposições a agentes ambientais ultrapassem os limites de tolerância. As ações devem incluir monitoramento periódico da exposição, a informação aos trabalhadores e o controle médico.",
    ),
    p(
      "Deverão ser objeto de controle sistemático as situações que apresentem exposição ocupacional acima dos níveis de ação, conforme indicado:",
    ),
    item(
      "- Para agentes químicos a metade dos limites de exposição ocupacional acima dos níveis de ação, de acordo com a legislação prevista;",
    ),
    item(
      "- Para o ruído, a dose de 0,5 (dose superior a 50%), conforme critério estabelecido na NR 15.",
    ),
    item(
      "- Segue quadro com resultados das avaliações realizadas em visita técnica, com parâmetros de nível de ação e limite de tolerância.",
    ),
    p(
      "**Nota:** o monitoramento quantitativo dos agentes ambientais, conforme resultados apresentados na tabela, não detectou valores consideráveis e/ou passíveis de provocar danos à saúde dos colaboradores. (Referência para limites de tolerância: ACGIH/NR0).",
    ),
  ],
  cipa: [
    p(
      "Em conformidade com a Norma Regulamentadora nº 05 (NR-05), este estabelecimento, classificado com Grau de Risco {grauRisco} e possuindo {numeroEmpregados} empregados, manterá constituída a Comissão Interna de Prevenção de Acidentes e de Assédio – CIPAA, dimensionada de acordo com o Quadro I da norma vigente.",
    ),
    p(
      "A comissão será composta por {cipaTitulares} representantes titulares e {cipaSuplentes} representantes suplentes eleitos pelos empregados, por meio de processo eleitoral realizado em escrutínio secreto, bem como por {cipaTitulares} representantes titulares e {cipaSuplentes} representantes suplentes indicados pelo empregador, assegurando a composição paritária prevista na NR-05.",
    ),
    p(
      "A CIPAA integra o Gerenciamento de Riscos Ocupacionais – GRO, atuando de forma permanente na prevenção de acidentes e doenças relacionadas ao trabalho, na promoção da saúde e segurança dos trabalhadores e na prevenção do assédio no ambiente laboral.",
    ),
    p(
      "Compete à comissão participar da identificação de perigos, da avaliação dos riscos ocupacionais, das inspeções de segurança, da investigação de acidentes e incidentes, do acompanhamento das medidas corretivas e preventivas e da promoção de ações educativas relacionadas à Segurança e Saúde no Trabalho, contribuindo para a melhoria contínua das condições de trabalho.",
    ),
    p(
      "Os membros titulares e suplentes da CIPAA deverão receber treinamento antes da posse, conforme estabelece a NR-05, com carga horária mínima de {cipaHorasTreinamento} horas, por se tratar de estabelecimento classificado em Grau de Risco {grauRisco}. O treinamento deverá ser realizado durante o expediente normal da empresa, sem ônus para os participantes, e contemplará o conteúdo programático mínimo previsto na norma, abrangendo a organização da CIPAA, estudo do ambiente, das condições e dos riscos do processo de trabalho, metodologia de investigação e análise de acidentes e doenças relacionadas ao trabalho, princípios do Gerenciamento de Riscos Ocupacionais (GRO) e do Programa de Gerenciamento de Riscos (PGR), medidas de prevenção, noções sobre legislação de Segurança e Saúde no Trabalho, bem como prevenção e combate ao assédio sexual e às demais formas de violência no ambiente de trabalho.",
    ),
    p(
      "A organização assegurará o funcionamento regular da comissão mediante a realização de reuniões periódicas, registro das deliberações em atas, acompanhamento das ações propostas e integração de suas atividades com o Programa de Gerenciamento de Riscos – PGR, o PCMSO e os demais programas de Segurança e Saúde no Trabalho, mantendo a documentação pertinente disponível para fins de acompanhamento e fiscalização.",
    ),
  ],
  fieldRecord: [
    p(
      "É o registro de todos os dados ou ocorrências observadas durante a avaliação do ambiente de trabalho. As informações foram tomadas de maneira organizada e anotadas em formulários apropriados de modo que possam contribuir para as conclusões das avaliações (planilha de reconhecimento e avaliação de risco por função) em anexo.",
    ),
  ],
  psychosocial: [
    p(
      "Em atendimento à Norma Regulamentadora nº 01 (NR-01), ao Gerenciamento de Riscos Ocupacionais (GRO) e às orientações do Ministério do Trabalho e Emprego relativas à inclusão dos fatores de risco psicossociais relacionados ao trabalho, a organização estabelece processo sistemático para identificação, avaliação, tratamento e monitoramento destes fatores no âmbito do Programa de Gerenciamento de Riscos – PGR.",
    ),
    p(
      "Os fatores de risco psicossociais relacionados ao trabalho compreendem aspectos decorrentes da concepção, organização, gestão e execução das atividades laborais que possam produzir impactos na saúde física, mental ou social dos trabalhadores. Tais fatores serão considerados juntamente com os demais riscos ocupacionais previstos na legislação, integrando o Inventário de Riscos Ocupacionais da organização.",
    ),
    p(
      "A identificação dos fatores de risco psicossociais será realizada mediante metodologia compatível com a realidade da organização, contemplando a análise das condições de trabalho, da organização das atividades, das relações socioprofissionais, dos processos de gestão, dos mecanismos de comunicação, das exigências laborais e demais aspectos que possam influenciar o bem-estar dos trabalhadores. Para este levantamento poderão ser utilizados questionários, entrevistas, observações em campo, oficinas participativas, análise documental e avaliação de indicadores organizacionais, de forma isolada ou combinada.",
    ),
    p(
      "A avaliação deverá considerar informações referentes aos processos de trabalho, características das atividades desenvolvidas, grupos de trabalhadores expostos, contexto organizacional e demais elementos necessários para caracterização dos fatores de risco existentes, observando os princípios da prevenção e da melhoria contínua.",
    ),
    p(
      "Sempre que identificados fatores de risco psicossociais relevantes, a organização deverá estabelecer medidas de prevenção e controle direcionadas prioritariamente às causas organizacionais identificadas, por meio de plano de ação contendo responsabilidades, prazos e formas de acompanhamento da eficácia das medidas implementadas.",
    ),
    p(
      "A gestão dos fatores de risco psicossociais deverá ocorrer de forma integrada às ações de ergonomia previstas na NR-17, podendo utilizar, quando aplicável, os resultados da Avaliação Ergonômica Preliminar (AEP), da Análise Ergonômica do Trabalho (AET) e demais avaliações relacionadas às condições e à organização do trabalho.",
    ),
    p(
      "Os resultados das avaliações, os fatores de risco identificados, as medidas de prevenção adotadas e os registros de monitoramento deverão ser mantidos como evidência do atendimento aos requisitos legais e do gerenciamento contínuo dos riscos ocupacionais.",
    ),
    p(
      "A revisão dos fatores de risco psicossociais deverá ocorrer periodicamente e sempre que houver alterações significativas na organização do trabalho, nos processos produtivos, nas condições operacionais ou quando indicadores internos demonstrarem a necessidade de reavaliação.",
    ),
    p(
      "A organização reconhece que o gerenciamento dos fatores de risco psicossociais constitui parte integrante do GRO, contribuindo para a promoção da saúde, da segurança, da qualidade de vida no trabalho e da sustentabilidade organizacional, em conformidade com os princípios estabelecidos pela NR-01.",
    ),
  ],
  classification: [
    p(
      "Segundo a NR 09, esta Norma Regulamentadora - NR estabelece os requisitos para a avaliação das exposições ocupacionais a agentes físicos, químicos e biológicos quando identificados no Programa de Gerenciamento de Riscos - PGR, previsto na NR-1, e subsidiá-lo quanto às medidas de prevenção para os riscos ocupacionais:",
    ),
  ],
  communication: [
    p(
      "A organização reconhece a comunicação como elemento fundamental para a efetividade do Gerenciamento de Riscos Ocupacionais – GRO e para a promoção de ambientes de trabalho seguros e saudáveis. Dessa forma, manterá processos de comunicação destinados a disseminar informações relacionadas aos perigos, riscos ocupacionais, medidas de prevenção, procedimentos de segurança e demais aspectos relevantes à Segurança e Saúde no Trabalho.",
    ),
    p(
      "As informações serão disponibilizadas aos trabalhadores por meios adequados à realidade da organização, podendo incluir treinamentos, integrações, diálogos de segurança, reuniões, campanhas educativas, comunicados internos, murais informativos, sistemas informatizados, correio eletrônico, aplicativos de mensagens e outros canais considerados pertinentes. A comunicação deverá ocorrer de forma clara, objetiva e acessível, permitindo a compreensão dos riscos existentes e das medidas de prevenção adotadas.",
    ),
    p(
      "Como parte das ações de promoção da saúde e prevenção de riscos ocupacionais, a organização poderá realizar campanhas periódicas de conscientização voltadas à segurança, saúde ocupacional, ergonomia, prevenção de acidentes, qualidade de vida e demais temas relacionados ao bem-estar dos trabalhadores. Essas campanhas poderão ser desenvolvidas de acordo com as necessidades identificadas nos processos de avaliação de riscos, nos indicadores internos ou em decorrência de requisitos legais e normativos aplicáveis.",
    ),
    p(
      "Em relação aos fatores de risco psicossociais relacionados ao trabalho, a organização poderá promover ações educativas e campanhas de conscientização voltadas à saúde mental, ao respeito nas relações de trabalho, à prevenção do assédio, à comunicação interpessoal, à gestão do estresse ocupacional, à qualidade de vida e aos demais aspectos relacionados à organização do trabalho que possam influenciar a saúde e o bem-estar dos trabalhadores. Essas ações terão caráter preventivo e educativo, contribuindo para o fortalecimento da cultura organizacional e para a melhoria contínua das condições de trabalho.",
    ),
    p(
      "A organização incentivará a participação dos trabalhadores no processo de gerenciamento de riscos ocupacionais, estimulando a comunicação de situações de risco, sugestões de melhoria e contribuições relacionadas à segurança e saúde no trabalho. Sempre que aplicável, as informações obtidas por meio da participação dos trabalhadores poderão ser consideradas na revisão dos riscos ocupacionais, na definição de medidas de prevenção e na elaboração dos respectivos planos de ação.",
    ),
    p(
      "Os treinamentos, orientações e ações de conscientização promovidos pela organização deverão ser compatíveis com os riscos ocupacionais identificados e com as atividades desenvolvidas pelos trabalhadores, buscando assegurar que todos compreendam suas responsabilidades e contribuam para a prevenção de acidentes, incidentes e agravos à saúde.",
    ),
    p(
      "Os registros das ações de comunicação, campanhas, treinamentos e demais atividades de conscientização poderão ser mantidos pela organização como evidência do atendimento aos requisitos legais e da implementação das ações previstas no Programa de Gerenciamento de Riscos – PGR.",
    ),
    p(
      "A eficácia das ações de comunicação e conscientização poderá ser avaliada periodicamente por meio da análise de indicadores, da participação dos trabalhadores, dos resultados das avaliações de riscos, das auditorias internas, das análises críticas e de outros mecanismos de monitoramento adotados pela organização, visando a melhoria contínua do sistema de gestão de Segurança e Saúde no Trabalho.",
    ),
  ],
  riskCategoryProbability: [
    sub("Tabelas de Gradação de Probabilidade e Severidade"),
    p(
      "As tabelas de gradação de severidade e probabilidade sugeridas são as tabelas da AIHA – American Industrial Hygiene Association, AS/NZS 4360 e European Comission (recomendadas pela Fundacentro). Todas elas possuem gradações de 1 a 5, que vão determinar a classificação da severidade e probabilidade. As gradações de probabilidade são 5 (cinco):",
    ),
    item("- Rara (1);"),
    item("- Pouco Provável (2);"),
    item("- Possível (3);"),
    item("- Provável (4);"),
    item("- Muito Provável (5)."),
    p(
      "Nas avaliações qualitativas, de acordo com o controle e exposição ao risco, determina-se de 1 a 5 o nível de probabilidade. Em avaliações quantitativas, a probabilidade é classificada de acordo com a porcentagem do valor de exposição ao LEO - Limite de Exposição Ocupacional.",
    ),
  ],
  riskCategorySeverity: [
    p("As gradações de severidade são 5 (cinco):"),
    item("- Leve (1);"),
    item("- Baixa (2);"),
    item("- Moderada (3);"),
    item("- Alta (4);"),
    item("- Extrema (5)."),
    p(
      "A severidade é classificada de 1 a 5, de acordo com o nível de consequência à exposição.",
    ),
  ],
  riskCategoryMatrix: [
    sub("Matriz de Risco Utilizada"),
    p(
      "A Matriz de Risco utilizada neste Programa de Gerenciamento de Riscos é uma matriz no formato 5x5, baseada nas estimativas de gradações de Severidade e Probabilidade da AIHA – American Industrial Hygiene Association, AS/NZS 4360 e European Comission (recomendadas pela Fundacentro). Esta matriz funciona para avaliações qualitativas e quantitativas, pois as tabelas de gradações sugeridas possuem as estimativas adequadas para ambas as avaliações. Os níveis de risco presentes na matriz são 5 (cinco):",
    ),
    item("- Trivial ({faixaTrivial});"),
    item("- Tolerável ({faixaToleravel});"),
    item("- Moderado ({faixaModerado});"),
    item("- Substancial ({faixaSubstancial});"),
    item("- Intolerável ({faixaIntoleravel})."),
    p(
      "Cada nível de risco possui o seu método de controle sugerido, baseado na estimativa (grau de certeza) da avaliação, onde os riscos de níveis mais altos têm prioridade de ação.",
    ),
  ],
  riskCategoryExample: [
    sub("Exemplo de aplicação"),
    item(
      "1. Probabilidade: ruído ocupacional de 40 dB é > 10% e < 50% do LEO (85 dB) permitido para 8 horas de atividade, classificando-o como probabilidade de nível 2 (pouco provável), de acordo com a tabela de gradação AIHA.",
    ),
    item(
      "2. Severidade: a severidade de uma doença que possa surgir de um ruído ocupacional classifica-se como “Lesão ou doenças críticas irreversíveis que podem limitar a capacidade funcional”, de acordo com a tabela sugerida, classificando-a como severidade de nível 3 (moderada).",
    ),
    item(
      "3. Nível do Risco: o nível do risco é a probabilidade x (vezes) a severidade. No caso, 2 x 3, resultando em 6 ({classeExemplo}) de acordo com a matriz.",
    ),
    RISK_MATRIX_ASYMMETRY_NOTE,
    sub("Análise de Suficiência de Controle dos Riscos"),
    p(
      "Os métodos de controle são classificados de acordo com o nível do risco e grau de incerteza da estimativa da avaliação. Os níveis de risco mais altos devem ter prioridade no plano de ação ao final do documento. A Priorização da ação de controle é classificada de acordo com a estimativa, que pode ser: certa (0), incerta (1) e altamente incerta (2). Esta classificação padrão dos métodos de controle funciona apenas para o Inventário de Riscos e não deve ser adotada como método único para priorização do Plano de Ação. Contudo, como as ações de controle serão feitas baseadas no inventário, estas classificações servem para definir a prioridade das ações.",
    ),
    p("A tabela utilizada foi recomendada pela Fundacentro."),
  ],
} satisfies Record<string, RichBlock[]>;

export type PgrDocxTextKey = keyof typeof DEFAULT_TEXTS;

export type PgrDocxCampaign = { month: string; theme: string; actions: string };

/** Cronograma anual de campanhas (seção 22) — lista semi-fixa, editável por PGR. */
export const DEFAULT_CAMPAIGNS: PgrDocxCampaign[] = [
  {
    month: "Janeiro",
    theme: "Janeiro Branco",
    actions:
      "Palestra sobre saúde mental; divulgação de materiais educativos; abertura de canal de apoio psicossocial.",
  },
  {
    month: "Abril",
    theme: "Abril Verde",
    actions:
      "Campanha educativa sobre segurança; blitz de inspeção de EPI/EPC; treinamentos e DDS especiais.",
  },
  {
    month: "Maio",
    theme: "Maio Amarelo",
    actions:
      "Treinamento sobre direção segura; cartazes e vídeos de conscientização; orientações sobre deslocamento seguro ao trabalho.",
  },
  {
    month: "Julho",
    theme: "27 de julho – Dia Nacional de Prevenção de Acidentes",
    actions:
      "Evento interno de SST; relato de boas práticas; campanha de valorização da segurança.",
  },
  {
    month: "Agosto",
    theme: "Agosto Lilás",
    actions:
      "Campanhas de conscientização sobre violência contra a mulher; palestras e ações educativas no ambiente de trabalho; divulgação dos canais de denúncia e apoio; incentivo ao respeito, igualdade e combate ao assédio.",
  },
  {
    month: "Setembro",
    theme: "Setembro Amarelo",
    actions:
      "Palestras e campanhas sobre saúde mental; divulgação de canais de apoio psicológico; ações de acolhimento e escuta ativa.",
  },
  {
    month: "Outubro",
    theme: "Outubro Rosa",
    actions:
      "Palestra com profissional de saúde; material educativo; incentivo à realização de exames preventivos.",
  },
  {
    month: "Novembro",
    theme: "Novembro Azul",
    actions:
      "Ações de conscientização; roda de conversa com profissionais de saúde; incentivo a consultas e check-ups.",
  },
];

/**
 * Tabelas da metodologia (seção 17). No PGR de referência são imagens com o título
 * marcado em laranja: viram tabelas de verdade, semi-fixas — o padrão é a AIHA/Fundacentro
 * e o PGR pode trocar o conteúdo. A matriz 5×5 (classe de cada célula) é
 * `PGR_DOCX_RISK_MATRIX`, em `theme.ts`.
 */
export type PgrDocxMethodology = {
  probabilityQuantitative: {
    caption: string;
    source: string;
    rows: { level: string; category: string; exposure: string }[];
  };
  probabilityQualitative: {
    caption: string;
    rows: { level: string; control: string; prevention: string }[];
  };
  severity: {
    caption: string;
    source: string;
    rows: { level: string; definition: string }[];
  };
  matrix: {
    title: string;
    subtitle: string;
    /** Rótulos das colunas de severidade 1 → 5. */
    severityLabels: string[];
    /** Rótulos das linhas de probabilidade 1 → 5. */
    probabilityLabels: string[];
  };
  controlNeed: Record<
    "intolerable" | "substantial" | "moderate" | "tolerable" | "trivial",
    { certain: string; uncertain: string; highlyUncertain: string }
  >;
};

export const DEFAULT_METHODOLOGY: PgrDocxMethodology = {
  probabilityQuantitative: {
    caption:
      "Estimativa de Probabilidade baseada no LEO (Limite de Exposição Ocupacional (sem considerar EPI))",
    source: "AIHA (2015)",
    rows: [
      {
        level: "1",
        category: "Exposição a níveis muito baixos",
        exposure: "Exposições <10% LEO",
      },
      {
        level: "2",
        category: "Exposição baixa",
        exposure: "Exposições > 10% e <50% LEO",
      },
      {
        level: "3",
        category: "Exposição moderada",
        exposure: "Exposições > 50% e <100% LEO",
      },
      {
        level: "4",
        category: "Exposição excessiva",
        exposure: "Exposições > 100% e 500% LEO",
      },
      {
        level: "5",
        category: "Exposição muito excessiva",
        exposure: "Exposições superiores a 5 x LEO",
      },
    ],
  },
  probabilityQualitative: {
    caption:
      "Estimativa de Probabilidade para avaliação de Riscos Mecânicos, Ergonômicos, Biológicos, Químicos, Físicos e outros",
    rows: [
      {
        level: "1",
        control: "Controle Excelente",
        prevention: "Representa a melhor tecnologia ou prática de controle disponível.",
      },
      {
        level: "2",
        control: "Controle em conformidade legal",
        prevention: "Controle seguindo as normas legais, mantido adequadamente.",
      },
      {
        level: "3",
        control: "Controle com pequenas deficiências",
        prevention:
          "Controle adequado com pequenas deficiências na operação ou manutenção.",
      },
      {
        level: "4",
        control: "Controle deficiente",
        prevention: "Controle incompleto ou com deficiências relevantes.",
      },
      {
        level: "5",
        control: "Controle inexistente",
        prevention: "As medidas de controle são inexistentes ou totalmente inadequadas.",
      },
    ],
  },
  severity: {
    caption: "Estimativas de Severidade",
    source: "AIHA (2015)",
    rows: [
      {
        level: "1",
        definition: "Lesão leve sem necessidade atenção médica, incômodos ou mal estar.",
      },
      { level: "2", definition: "Lesão ou doenças sérias reversíveis." },
      {
        level: "3",
        definition:
          "Lesões ou doenças críticas irreversíveis que podem limitar a capacidade funcional.",
      },
      { level: "4", definition: "Lesão ou doença incapacitante ou mortal." },
      { level: "5", definition: "Mortes ou incapacidades múltiplas (>10)." },
    ],
  },
  matrix: {
    title: "MATRIZ DE RISCO 5X5",
    subtitle: "Baseada na Metodologia AIHA",
    severityLabels: ["Leve", "Baixa", "Moderada", "Alta", "Extrema"],
    probabilityLabels: [
      "Rara",
      "Pouco provável",
      "Possível",
      "Provável",
      "Muito provável",
    ],
  },
  controlNeed: {
    intolerable: {
      certain: "Ação imediata ou interrupção da atividade",
      uncertain: "Controle e informação adicional necessária",
      highlyUncertain: "Controle e informação adicional necessária",
    },
    substantial: {
      certain: "Controle necessário",
      uncertain: "Controle e informação adicional necessária",
      highlyUncertain: "Controle e informação adicional necessária",
    },
    moderate: {
      certain: "Controle adicional, se possível/viável",
      uncertain: "Informação adicional necessária",
      highlyUncertain: "Informação adicional necessária",
    },
    tolerable: {
      certain: "Nenhum controle adicional necessário",
      uncertain: "Informação adicional necessária",
      highlyUncertain: "Informação adicional necessária",
    },
    trivial: {
      certain: "Nenhuma ação necessária",
      uncertain: "Nenhuma informação adicional é necessária",
      highlyUncertain: "Nenhuma informação adicional é necessária",
    },
  },
};
