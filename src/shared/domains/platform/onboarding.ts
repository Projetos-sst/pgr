import type { DashboardKpis } from "./dashboard";

/**
 * Contagens usadas pela Trilha de Sucesso: os KPIs núcleo do dashboard +
 * módulos "bônus" de alto uso que não fazem parte da cadeia obrigatória do PGR.
 */
export type OnboardingCounts = DashboardKpis & {
  epiCatalogItems: number;
  serviceOrders: number;
};

export type OnboardingGroup = "essential" | "bonus";

export type OnboardingStep = {
  key: keyof OnboardingCounts;
  group: OnboardingGroup;
  title: string;
  description: string;
  /** Passos concretos mostrados na Trilha e injetados como dica na página de ação. */
  tips: string[];
  href: string;
};

/**
 * Passos de primeiros-passos. O "concluído" é DERIVADO dos dados reais do
 * tenant (não há flag persistida): o passo está feito quando a contagem
 * correspondente é > 0. `href` carrega `?onboarding=1` para a página de
 * destino saber que deve exibir as `tips` como instrução (ver `OnboardingTip`)
 * — não basta levar o usuário até lá sem explicar o quê fazer.
 *
 * `essential` é a cadeia núcleo do PGR (empresa→funcionário→GES→risco→PGR) —
 * só ela conta para `percent`/`allDone`/o badge do tutorial. `bonus` cobre
 * módulos de alto uso fora dessa cadeia (estoque de EPI, ordem de serviço);
 * aparecem como "opcionais" e não bloqueiam a conclusão da trilha.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "companies",
    group: "essential",
    title: "Cadastrar a primeira empresa",
    description:
      "A empresa-cliente é a raiz da cadeia do PGR: unidades, GES, funcionários e o documento final dependem dela.",
    tips: [
      "Preencha o CNPJ primeiro — o sistema busca razão social e endereço automaticamente.",
      "Razão social é o único campo obrigatório além do CNPJ; o resto pode ser completado depois.",
      "Uma empresa pode ter várias unidades (obras/filiais) — cadastre a matriz agora e as unidades na etapa do GES.",
    ],
    href: "/companies/new?onboarding=1",
  },
  {
    key: "employees",
    group: "essential",
    title: "Cadastrar um funcionário",
    description:
      "Os trabalhadores expostos da empresa-cliente. Cada funcionário fica ligado a uma empresa e, opcionalmente, a um GES e uma função.",
    tips: [
      "Selecione a empresa cadastrada no passo anterior.",
      "CPF e dados pessoais podem ser completados depois — o vínculo com a empresa é o que importa aqui.",
      "GES e função são opcionais no cadastro do funcionário; associe-os quando montar o GES no próximo passo.",
    ],
    href: "/employees/new?onboarding=1",
  },
  {
    key: "ges",
    group: "essential",
    title: "Montar um GES",
    description:
      "O Grupo de Exposição Similar organiza a cadeia Empresa → Unidade de obra → GES → Funções associadas.",
    tips: [
      "Escolha a empresa e, se ainda não existir, crie a unidade de obra direto no formulário.",
      "Um GES agrupa funções que compartilham o mesmo tipo de exposição a risco.",
      "Depois de salvar o GES, associe as funções e a quantidade de trabalhadores expostos em cada uma.",
    ],
    href: "/ges/new?onboarding=1",
  },
  {
    key: "risks",
    group: "essential",
    title: "Inventariar um risco",
    description:
      "Risco identificado num GES: agente (físico, químico, ergonômico...), perigo e descrição da exposição — base do inventário NR-01/GRO.",
    tips: [
      "Selecione o GES montado no passo anterior — o risco sempre pertence a um GES.",
      "Escolha o tipo de agente (físico, químico, biológico, ergonômico ou acidente) antes de descrever o perigo.",
      "Depois de criar o risco, defina as medidas de controle (plano de ação) na tela do próprio risco.",
    ],
    href: "/risks/new?onboarding=1",
  },
  {
    key: "pgrs",
    group: "essential",
    title: "Criar o documento PGR",
    description:
      "O Programa de Gerenciamento de Riscos consolida a empresa, seus GES e riscos inventariados num único documento (NR-01/GRO).",
    tips: [
      "Escolha a empresa — o PGR reúne automaticamente os GES e riscos já cadastrados para ela.",
      "A criação exige o aceite da Declaração de Ciência de Riscos — leia antes de confirmar.",
      "Depois de criado, o PGR mostra a validade e os planos de ação pendentes no dashboard.",
    ],
    href: "/pgr/new?onboarding=1",
  },
  {
    key: "epiCatalogItems",
    group: "bonus",
    title: "Cadastrar um EPI no catálogo",
    description:
      "O catálogo de EPI/máquinas é a base do estoque e das entregas assinadas para os funcionários.",
    tips: [
      "Informe o nome e o tipo do item (EPI ou máquina/equipamento).",
      "Para EPI, o CA (Certificado de Aprovação) é validado automaticamente contra a base do MTE.",
      "Depois de cadastrado, adicione o item ao estoque em Estoque de EPI → Adicionar.",
    ],
    href: "/epi-catalog/new?onboarding=1",
  },
  {
    key: "serviceOrders",
    group: "bonus",
    title: "Emitir uma Ordem de Serviço",
    description:
      "A OS formaliza, por função/funcionário, os riscos e medidas de proteção — documento exigido pela NR-01.",
    tips: [
      "O número da OS é gerado automaticamente pelo escritório ao salvar.",
      "Associe um funcionário para poder coletar a assinatura depois.",
      "OS assinadas aparecem no card \"OS Funcional\" do dashboard.",
    ],
    href: "/service-orders/new?onboarding=1",
  },
];

export type OnboardingStepView = OnboardingStep & { done: boolean };

export type OnboardingProgress = {
  /** Cadeia núcleo do PGR — determina `percent`/`allDone`/o badge do tutorial. */
  steps: OnboardingStepView[];
  /** Módulos de alto uso fora da cadeia núcleo — não bloqueiam a conclusão. */
  bonusSteps: OnboardingStepView[];
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
};

export function deriveOnboardingProgress(counts: OnboardingCounts): OnboardingProgress {
  const toView = (step: OnboardingStep): OnboardingStepView => ({
    ...step,
    done: (counts[step.key] ?? 0) > 0,
  });

  const steps = ONBOARDING_STEPS.filter((s) => s.group === "essential").map(toView);
  const bonusSteps = ONBOARDING_STEPS.filter((s) => s.group === "bonus").map(toView);
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return {
    steps,
    bonusSteps,
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    allDone: completed === total,
  };
}
