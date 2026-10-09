/**
 * Fonte única de verdade do conteúdo do portal público.
 *
 * Tudo aqui é **verificado contra o código**: cada módulo listado aponta a rota
 * real da área autenticada (`src/app/(protected)/…`) e/ou o schema que o
 * sustenta. O campo `availability` é o contrato de honestidade da landing —
 * nada entra como `available` sem rota e tabela existentes. Funcionalidade
 * citada na reunião mas ainda sem código entra como `planned`, com rótulo
 * explícito na interface.
 *
 * Mantido como dado puro (sem JSX) para poder ser consumido por Server
 * Components, por testes unitários e pelo `AuthFrame`.
 */

export type Availability = "available" | "evolving" | "planned";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Disponível",
  evolving: "Em evolução",
  planned: "Planejado",
};

export type IconName =
  | "shield"
  | "stethoscope"
  | "alert-triangle"
  | "clipboard-check"
  | "layers"
  | "hardhat"
  | "building"
  | "users"
  | "book-open"
  | "file-text"
  | "calendar"
  | "activity"
  | "heart-pulse"
  | "folder"
  | "pen-tool"
  | "brain"
  | "car"
  | "wrench"
  | "lock"
  | "search"
  | "route"
  | "check";

export type PlatformModule = {
  name: string;
  description: string;
  icon: IconName;
  availability: Availability;
  /** Rota real da área autenticada que entrega o recurso (evidência). */
  route: string | null;
};

/* ------------------------------------------------------------------ marca */

export const BRAND = {
  name: "PGR-e",
  tagline: "Saúde e segurança do trabalho em uma só plataforma",
  description:
    "Plataforma multiempresa para organizar as rotinas de Segurança e de Medicina do Trabalho: cadastros, gestão de riscos, medidas de controle, plano de ação e a elaboração do PGR.",
} as const;

/* ------------------------------------------------------------- navegação */

export const PUBLIC_NAV = [
  { href: "/seguranca-do-trabalho", label: "Segurança do Trabalho" },
  { href: "/medicina-do-trabalho", label: "Medicina do Trabalho" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#como-funciona", label: "Como funciona" },
] as const;

/* --------------------------------------------------------- duas vertentes */

export const AREAS = [
  {
    slug: "seguranca-do-trabalho",
    eyebrow: "Vertente 1",
    title: "Segurança do Trabalho",
    promise: "Organização, controle e prevenção",
    summary:
      "Do cadastro da empresa ao documento assinado: inventário de riscos, avaliação por metodologia configurável, hierarquia de medidas de controle, plano de ação e o PGR gerado a partir dos dados reais.",
    highlights: [
      "Inventário e avaliação de riscos",
      "Hierarquia de medidas de controle",
      "Plano de ação com 5W2H",
      "Elaboração do PGR",
    ],
    accent: "indigo",
  },
  {
    slug: "medicina-do-trabalho",
    eyebrow: "Vertente 2",
    title: "Medicina do Trabalho",
    promise: "Cuidado, acompanhamento e eficiência",
    summary:
      "O acompanhamento da saúde ocupacional conectado aos mesmos cadastros da Segurança: ASO por funcionário, médicos responsáveis, controle de validade dos exames e avaliação de riscos psicossociais.",
    highlights: [
      "ASO e aptidão por funcionário",
      "Cadastro de médicos do trabalho",
      "Controle de validade de exames",
      "Riscos psicossociais",
    ],
    accent: "teal",
  },
] as const;

export type Area = (typeof AREAS)[number];

/* ----------------------------------------------- módulos — Segurança */

export const SAFETY_MODULES: PlatformModule[] = [
  {
    name: "PGR",
    description:
      "Programa de Gerenciamento de Riscos montado a partir dos cadastros, com revisões, assinatura e geração do documento.",
    icon: "alert-triangle",
    availability: "available",
    route: "/pgr",
  },
  {
    name: "Inventário de riscos",
    description:
      "Riscos por GES, com agente, fonte geradora, propagação, tempo de exposição e possíveis lesões.",
    icon: "search",
    availability: "available",
    route: "/risks",
  },
  {
    name: "Avaliação e metodologia",
    description:
      "Classificação de risco configurável por escritório — de trivial a intolerável — com a orientação de ação de cada nível.",
    icon: "clipboard-check",
    availability: "available",
    route: "/risk-methodology",
  },
  {
    name: "Medidas de controle",
    description:
      "Hierarquia de controle por risco: eliminação, proteção coletiva, administrativo e EPI, com o 5W2H de cada medida.",
    icon: "layers",
    availability: "available",
    route: "/risks",
  },
  {
    name: "Plano de ação",
    description:
      "Ações com responsável, prazo e acompanhamento de execução, ligadas às medidas de controle.",
    icon: "calendar",
    availability: "available",
    route: "/action-plans",
  },
  {
    name: "Gestão de EPI",
    description:
      "Catálogo com consulta de CA, estoque com saldo transacional, entrega com assinatura e devolução.",
    icon: "hardhat",
    availability: "available",
    route: "/epi-stock",
  },
  {
    name: "Inspeções",
    description:
      "Planos de inspeção reutilizáveis e execução em segurança, equipamentos e veículos.",
    icon: "wrench",
    availability: "available",
    route: "/inspection-plans",
  },
  {
    name: "Treinamentos",
    description:
      "Catálogo com periodicidade, registro de realização, obrigatórios por função e controle de vencimento.",
    icon: "book-open",
    availability: "available",
    route: "/training-catalog",
  },
  {
    name: "Ordens de serviço e PT",
    description:
      "Ordem de serviço da NR-1 e permissões de trabalho para atividades de risco.",
    icon: "file-text",
    availability: "available",
    route: "/service-orders",
  },
  {
    name: "Incidentes",
    description:
      "Registro e tratamento de incidentes e acidentes, com investigação e vínculo ao plano de ação.",
    icon: "alert-triangle",
    availability: "available",
    route: "/incidents",
  },
  {
    name: "eSocial (SST)",
    description:
      "Configuração e painel dos eventos de SST, com acompanhamento da situação de cada evento.",
    icon: "route",
    availability: "evolving",
    route: "/esocial",
  },
  {
    name: "Assinatura digital",
    description:
      "Coleta de assinatura por link público com token e QR, usada nas entregas de EPI e no PGR.",
    icon: "pen-tool",
    availability: "available",
    route: "/signatures",
  },
];

/* ------------------------------------------------ módulos — Medicina */

export const HEALTH_MODULES: PlatformModule[] = [
  {
    name: "ASO",
    description:
      "Atestado de Saúde Ocupacional por funcionário: tipo de exame, data, aptidão, validade e médico responsável.",
    icon: "activity",
    availability: "available",
    route: "/health-exams",
  },
  {
    name: "Médicos do trabalho",
    description:
      "Cadastro dos médicos responsáveis, com CRM, especialidade e clínica de vínculo.",
    icon: "stethoscope",
    availability: "available",
    route: "/medicos",
  },
  {
    name: "Validade dos exames",
    description:
      "A validade do ASO é calculada no registro e fica visível na ficha do funcionário.",
    icon: "calendar",
    availability: "available",
    route: "/health-exams",
  },
  {
    name: "Riscos psicossociais",
    description:
      "Campanhas com questionário anônimo por link, fatores de risco configuráveis e consolidação dos resultados.",
    icon: "brain",
    availability: "available",
    route: "/psychosocial/campaigns",
  },
  {
    name: "Documentos (GED)",
    description:
      "Guarda de documentos com pastas, versões e controle de validade — base para anexar laudos e certificados.",
    icon: "folder",
    availability: "evolving",
    route: "/documents",
  },
  {
    name: "PCMSO",
    description:
      "Programa de Controle Médico de Saúde Ocupacional. Previsto na evolução da vertente; ainda não implementado.",
    icon: "heart-pulse",
    availability: "planned",
    route: null,
  },
  {
    name: "Absenteísmo",
    description:
      "Acompanhamento de afastamentos e indicadores de absenteísmo. Previsto; ainda não implementado.",
    icon: "users",
    availability: "planned",
    route: null,
  },
  {
    name: "Clínicas e solicitação de exames",
    description:
      "Portal para clínicas parceiras e solicitação de exames. Em desenho; hoje a clínica é um dado do cadastro do médico.",
    icon: "building",
    availability: "planned",
    route: null,
  },
];

/* --------------------------------------------------------- benefícios */

export const BENEFITS = [
  {
    icon: "layers",
    title: "Um cadastro, vários documentos",
    text: "Empresa, unidade, função, GES e funcionário são cadastrados uma vez e alimentam riscos, PGR, EPI, treinamentos e ASO.",
  },
  {
    icon: "lock",
    title: "Cada escritório vê só o que é seu",
    text: "O isolamento entre organizações é aplicado na aplicação e reforçado no próprio banco de dados, em toda consulta.",
  },
  {
    icon: "route",
    title: "Do risco à ação, sem planilha solta",
    text: "A medida de controle nasce ligada ao risco e a ação nasce ligada à medida, com responsável e prazo.",
  },
  {
    icon: "clipboard-check",
    title: "Rastreabilidade do que mudou",
    text: "Revisões do PGR, histórico de movimentação de estoque e registro de escrita nas operações sensíveis.",
  },
  {
    icon: "pen-tool",
    title: "Assinatura sem instalar nada",
    text: "O trabalhador assina a entrega de EPI pelo celular, por um link com token — sem conta e sem aplicativo.",
  },
  {
    icon: "users",
    title: "Equipe com papéis distintos",
    text: "Convites por e-mail e papéis de acesso separam quem administra, quem opera e quem apenas consulta.",
  },
] as const;

/* ------------------------------------------------------- como funciona */

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Cadastre a estrutura",
    text: "Empresa, unidades, funções, grupos de exposição (GES) e funcionários.",
  },
  {
    step: "02",
    title: "Levante e avalie os riscos",
    text: "Riscos por GES, com avaliação pela metodologia de classificação do escritório.",
  },
  {
    step: "03",
    title: "Defina medidas e ações",
    text: "Medidas na hierarquia de controle e ações com responsável e prazo.",
  },
  {
    step: "04",
    title: "Acompanhe as rotinas",
    text: "EPI, treinamentos, inspeções, ASO e incidentes no mesmo lugar.",
  },
  {
    step: "05",
    title: "Gere o documento",
    text: "O PGR é montado a partir dos dados cadastrados, com revisão e assinatura.",
  },
] as const;

/* ------------------------------------------------------------------ FAQ */

export const FAQ = [
  {
    q: "A plataforma atende mais de uma empresa cliente?",
    a: "Sim. Cada escritório de SST trabalha com a sua própria carteira de empresas, e os dados de um escritório não são visíveis para outro. Dentro do escritório, você cadastra quantas empresas, unidades e funcionários precisar.",
  },
  {
    q: "O PGR é gerado a partir dos dados do sistema?",
    a: "Sim. O programa é montado com os cadastros reais — empresa, unidades, GES, riscos, avaliações e medidas de controle — e passa por revisão e assinatura antes de virar documento.",
  },
  {
    q: "Qual é a diferença entre as áreas de Segurança e de Medicina?",
    a: "São duas vertentes da mesma plataforma, sobre os mesmos cadastros. Segurança concentra riscos, medidas, PGR, EPI, inspeções e treinamentos. Medicina concentra o acompanhamento de saúde ocupacional, como o ASO e os médicos responsáveis. A Medicina está em evolução e isso está sinalizado recurso por recurso.",
  },
  {
    q: "Como funciona a assinatura das entregas de EPI?",
    a: "O sistema gera um link com token (também em QR Code) que abre no celular do trabalhador. Ele assina na tela, sem criar conta e sem instalar aplicativo. O link tem validade e é de uso único.",
  },
  {
    q: "Preciso instalar algo para usar?",
    a: "Não. A plataforma roda no navegador. O acesso é por conta de usuário, com convite por e-mail para a sua equipe.",
  },
  {
    q: "O que ainda não está pronto?",
    a: "PCMSO, acompanhamento de absenteísmo e o portal de clínicas com solicitação de exames não estão implementados. Esses itens aparecem marcados como planejados nas páginas das vertentes, e não como recursos disponíveis.",
  },
] as const;

/* ------------------------------------------- pitch das telas de autenticação */

/**
 * Argumentos exibidos no painel de marca das telas de login/cadastro.
 *
 * Substituem a lista anterior, que afirmava "IA com 92% de precisão na detecção
 * proativa" — um número sem nenhuma fonte no repositório. A sugestão de riscos
 * por IA existe de verdade (`ai-risk-suggestion`), mas o que se pode afirmar é
 * o fluxo (sugerir e revisar antes de aceitar), não uma taxa de acerto.
 */
export const AUTH_HIGHLIGHTS = [
  {
    title: "Gestão centralizada e rastreável",
    detail: "Riscos, EPI, treinamentos e assinaturas sobre o mesmo cadastro.",
    icon: "check",
  },
  {
    title: "Sugestão de riscos assistida por IA",
    detail: "A IA propõe; você revisa e decide o que entra no inventário.",
    icon: "activity",
  },
  {
    title: "Organizado pelas Normas Regulamentadoras",
    detail: "Estrutura de dados alinhada à NR-1, NR-6, NR-9, NR-17 e NR-18.",
    icon: "shield",
  },
] as const satisfies readonly { title: string; detail: string; icon: IconName }[];
