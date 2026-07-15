import type { DashboardKpis } from "./dashboard";

export type OnboardingStep = {
  key: keyof DashboardKpis;
  title: string;
  description: string;
  href: string;
};

/**
 * Passos de primeiros-passos, na ordem da cadeia do PGR. O "concluído" é
 * DERIVADO dos dados reais do tenant (não há flag persistida): o passo está
 * feito quando o KPI correspondente é > 0.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "companies",
    title: "Cadastrar a primeira empresa",
    description: "A empresa-cliente é a raiz da cadeia do PGR.",
    href: "/companies/new",
  },
  {
    key: "employees",
    title: "Cadastrar um funcionário",
    description: "Os trabalhadores expostos das empresas-cliente.",
    href: "/employees/new",
  },
  {
    key: "ges",
    title: "Montar um GES",
    description: "Grupo de exposição similar + funções associadas.",
    href: "/ges/new",
  },
  {
    key: "risks",
    title: "Inventariar um risco",
    description: "Riscos do GES (agente, perigo, descrição).",
    href: "/risks/new",
  },
  {
    key: "pgrs",
    title: "Criar o documento PGR",
    description: "O Programa de Gerenciamento de Riscos da empresa.",
    href: "/pgr/new",
  },
];

export type OnboardingStepView = OnboardingStep & { done: boolean };

export type OnboardingProgress = {
  steps: OnboardingStepView[];
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
};

export function deriveOnboardingProgress(kpis: DashboardKpis): OnboardingProgress {
  const steps = ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: (kpis[step.key] ?? 0) > 0,
  }));
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  return {
    steps,
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    allDone: completed === total,
  };
}
