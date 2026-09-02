import { render, screen, act } from "@testing-library/react";

import { AgentProgress } from "../agent-progress";
import { STAGE_DWELL_MS } from "../agent-stages";

const STAGES = ["Pensando…", "Mapeando riscos…", "Organizando as sugestões…"] as const;

/**
 * O roteiro avança por tempo — sem timers falsos o teste dependeria de espera real.
 * Avançamos um tick **além** da fronteira do dwell: o intervalo não divide o dwell em
 * valores exatos, então parar em cima do limite testaria arredondamento, não o roteiro.
 */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("AgentProgress", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("abre na primeira etapa do roteiro", () => {
    render(<AgentProgress stages={STAGES} />);
    expect(screen.getByRole("status")).toHaveTextContent("Pensando…");
  });

  it("avança para a etapa seguinte conforme o tempo passa", () => {
    render(<AgentProgress stages={STAGES} />);
    advance(STAGE_DWELL_MS + 200);
    expect(screen.getByRole("status")).toHaveTextContent("Mapeando riscos…");
    advance(STAGE_DWELL_MS + 200);
    expect(screen.getByRole("status")).toHaveTextContent("Organizando as sugestões…");
  });

  it("permanece na última etapa numa espera mais longa que o roteiro", () => {
    render(<AgentProgress stages={STAGES} />);
    advance(STAGE_DWELL_MS * 20);
    expect(screen.getByRole("status")).toHaveTextContent("Organizando as sugestões…");
  });

  it("a barra avança sem nunca chegar a 100% (a resposta é quem conclui)", () => {
    render(<AgentProgress stages={STAGES} />);
    const bar = screen.getByRole("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBe(0);

    advance(5000);
    const meio = Number(bar.getAttribute("aria-valuenow"));
    expect(meio).toBeGreaterThan(0);

    advance(60_000);
    const fim = Number(bar.getAttribute("aria-valuenow"));
    expect(fim).toBeGreaterThan(meio);
    expect(fim).toBeLessThan(100);
  });

  it("anuncia a troca de etapa para leitores de tela", () => {
    render(<AgentProgress stages={STAGES} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("para o timer ao desmontar (a resposta chegou)", () => {
    const { unmount } = render(<AgentProgress stages={STAGES} />);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
