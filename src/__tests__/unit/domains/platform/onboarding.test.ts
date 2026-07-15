import {
  ONBOARDING_STEPS,
  deriveOnboardingProgress,
} from "@/shared/domains/platform/onboarding";
import type { DashboardKpis } from "@/shared/domains/platform/dashboard";

function kpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    companies: 0,
    employees: 0,
    workUnits: 0,
    ges: 0,
    risks: 0,
    pgrs: 0,
    ...overrides,
  };
}

describe("deriveOnboardingProgress", () => {
  it("organização vazia → nada concluído (0%)", () => {
    const p = deriveOnboardingProgress(kpis());
    expect(p.completed).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.allDone).toBe(false);
    expect(p.steps.every((s) => !s.done)).toBe(true);
  });

  it("marca o passo como feito quando o KPI é > 0", () => {
    const p = deriveOnboardingProgress(kpis({ companies: 2, ges: 1 }));
    expect(p.steps.find((s) => s.key === "companies")?.done).toBe(true);
    expect(p.steps.find((s) => s.key === "ges")?.done).toBe(true);
    expect(p.steps.find((s) => s.key === "pgrs")?.done).toBe(false);
    expect(p.completed).toBe(2);
  });

  it("todos os KPIs > 0 → 100% e allDone", () => {
    const p = deriveOnboardingProgress(
      kpis({ companies: 1, employees: 1, workUnits: 1, ges: 1, risks: 1, pgrs: 1 }),
    );
    expect(p.completed).toBe(ONBOARDING_STEPS.length);
    expect(p.percent).toBe(100);
    expect(p.allDone).toBe(true);
  });
});
