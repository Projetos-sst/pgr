import {
  ONBOARDING_STEPS,
  deriveOnboardingProgress,
  type OnboardingCounts,
} from "@/shared/domains/platform/onboarding";

function counts(overrides: Partial<OnboardingCounts> = {}): OnboardingCounts {
  return {
    companies: 0,
    employees: 0,
    workUnits: 0,
    ges: 0,
    risks: 0,
    pgrs: 0,
    epiCatalogItems: 0,
    serviceOrders: 0,
    ...overrides,
  };
}

const ESSENTIAL_COUNT = ONBOARDING_STEPS.filter((s) => s.group === "essential").length;
const BONUS_COUNT = ONBOARDING_STEPS.filter((s) => s.group === "bonus").length;

describe("deriveOnboardingProgress", () => {
  it("organização vazia → nada concluído (0%), bônus também zerado", () => {
    const p = deriveOnboardingProgress(counts());
    expect(p.completed).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.allDone).toBe(false);
    expect(p.steps.every((s) => !s.done)).toBe(true);
    expect(p.bonusSteps.every((s) => !s.done)).toBe(true);
  });

  it("marca o passo como feito quando a contagem é > 0", () => {
    const p = deriveOnboardingProgress(counts({ companies: 2, ges: 1 }));
    expect(p.steps.find((s) => s.key === "companies")?.done).toBe(true);
    expect(p.steps.find((s) => s.key === "ges")?.done).toBe(true);
    expect(p.steps.find((s) => s.key === "pgrs")?.done).toBe(false);
    expect(p.completed).toBe(2);
  });

  it("todos os essenciais > 0 → 100% e allDone, mesmo com bônus zerado", () => {
    const p = deriveOnboardingProgress(
      counts({ companies: 1, employees: 1, workUnits: 1, ges: 1, risks: 1, pgrs: 1 }),
    );
    expect(p.completed).toBe(ESSENTIAL_COUNT);
    expect(p.percent).toBe(100);
    expect(p.allDone).toBe(true);
    expect(p.bonusSteps.every((s) => !s.done)).toBe(true);
  });

  it("bônus não entra no percent/allDone dos essenciais", () => {
    const p = deriveOnboardingProgress(counts({ epiCatalogItems: 3, serviceOrders: 1 }));
    expect(p.completed).toBe(0);
    expect(p.allDone).toBe(false);
    expect(p.bonusSteps.filter((s) => s.done)).toHaveLength(BONUS_COUNT);
  });
});
