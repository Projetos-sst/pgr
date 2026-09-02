import {
  PROGRESS_CEILING,
  STAGE_DWELL_MS,
  agentProgressPercent,
  agentStageIndex,
} from "../agent-stages";

const STAGES = ["Pensando…", "Mapeando riscos…", "Organizando…"];

describe("agentStageIndex", () => {
  it("começa na primeira etapa", () => {
    expect(agentStageIndex(0, STAGES.length)).toBe(0);
  });

  it("avança uma etapa a cada dwell", () => {
    expect(agentStageIndex(STAGE_DWELL_MS - 1, STAGES.length)).toBe(0);
    expect(agentStageIndex(STAGE_DWELL_MS, STAGES.length)).toBe(1);
    expect(agentStageIndex(STAGE_DWELL_MS * 2, STAGES.length)).toBe(2);
  });

  it("trava na última etapa quando a resposta demora mais que o roteiro", () => {
    expect(agentStageIndex(STAGE_DWELL_MS * 50, STAGES.length)).toBe(STAGES.length - 1);
  });

  it("nunca devolve índice inválido (tempo negativo ou lista vazia)", () => {
    expect(agentStageIndex(-5000, STAGES.length)).toBe(0);
    expect(agentStageIndex(1000, 0)).toBe(0);
  });
});

describe("agentProgressPercent", () => {
  it("parte de 0 e cresce com o tempo", () => {
    expect(agentProgressPercent(0)).toBe(0);
    expect(agentProgressPercent(2000)).toBeGreaterThan(0);
    expect(agentProgressPercent(6000)).toBeGreaterThan(agentProgressPercent(2000));
  });

  it("desacelera: o primeiro trecho avança mais que o segundo", () => {
    const first = agentProgressPercent(3000) - agentProgressPercent(0);
    const second = agentProgressPercent(6000) - agentProgressPercent(3000);
    expect(first).toBeGreaterThan(second);
  });

  it("nunca ultrapassa o teto, mesmo numa espera muito longa", () => {
    expect(agentProgressPercent(10_000)).toBeLessThanOrEqual(PROGRESS_CEILING);
    expect(agentProgressPercent(600_000)).toBeLessThanOrEqual(PROGRESS_CEILING);
  });

  it("na latência típica do agente (~9s) já passou de 70%", () => {
    expect(agentProgressPercent(9000)).toBeGreaterThan(70);
  });
});
