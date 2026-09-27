/**
 * Domínio da avaliação ergonômica NR-17 (#40): Zod de entrada, rótulos das seis
 * dimensões, distinção `null` × `not_applicable`, regra determinística de vigência e
 * o contrato do bloco agregado da campanha psicossocial (que nunca é "escore COPSOQ").
 */
import {
  ERGONOMIC_ADEQUACIES,
  ERGONOMIC_DIMENSIONS,
  ERGONOMIC_DIMENSION_GROUPS,
  ERGONOMIC_METHOD_SUGGESTIONS,
  NOT_ASSESSED_LABEL,
  NO_ERGONOMIC_EVALUATION_LABEL,
  PSYCHOSOCIAL_AGGREGATE_LABEL,
  compareErgonomicEvaluations,
  countAssessedDimensions,
  countInadequateDimensions,
  currentErgonomicEvaluation,
  ergonomicAdequacyLabel,
  ergonomicAdequacyText,
  ergonomicAdequacyTone,
  ergonomicDimensionLabel,
  ergonomicDimensionNotesKey,
  ergonomicEvaluationInputSchema,
  formatCampaignPeriod,
  listErgonomicDimensions,
  summarizeErgonomicDimensions,
} from "@/shared/domains/pgr/ergonomics";

const CAMPAIGN = "0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f";

function base(overrides: Record<string, unknown> = {}) {
  return { assessedAt: "2026-09-27", ...overrides };
}

describe("ergonomics — vocabulário das dimensões", () => {
  it("tem exatamente as seis dimensões da NR-17, na ordem canônica", () => {
    expect(ERGONOMIC_DIMENSIONS).toEqual([
      "posture",
      "movements",
      "physicalLoad",
      "mentalLoad",
      "workOrganization",
      "physicalEnvironment",
    ]);
  });

  it("todas as dimensões têm rótulo pt-BR e campo de observação derivado", () => {
    for (const dimension of ERGONOMIC_DIMENSIONS) {
      expect(ergonomicDimensionLabel(dimension).length).toBeGreaterThan(0);
      expect(ergonomicDimensionNotesKey(dimension)).toBe(`${dimension}Notes`);
    }
  });

  it("os grupos do formulário cobrem as seis dimensões sem repetir", () => {
    const grouped = ERGONOMIC_DIMENSION_GROUPS.flatMap((g) => g.dimensions);
    expect(grouped.sort()).toEqual([...ERGONOMIC_DIMENSIONS].sort());
  });

  it("a adequação tem só três estados — nenhuma escala numérica", () => {
    expect(ERGONOMIC_ADEQUACIES).toEqual(["adequate", "inadequate", "not_applicable"]);
    expect(ergonomicAdequacyLabel("adequate")).toBe("Adequado");
    expect(ergonomicAdequacyLabel("inadequate")).toBe("Inadequado");
    expect(ergonomicAdequacyLabel("not_applicable")).toBe("Não aplicável");
  });

  it("null é 'não avaliado' e NUNCA é confundido com 'não aplicável' nem com 'adequado'", () => {
    expect(ergonomicAdequacyText(null)).toBe(NOT_ASSESSED_LABEL);
    expect(ergonomicAdequacyText(undefined)).toBe(NOT_ASSESSED_LABEL);
    expect(ergonomicAdequacyText("not_applicable")).toBe("Não aplicável");
    expect(ergonomicAdequacyText(null)).not.toBe(ergonomicAdequacyText("not_applicable"));
    expect(ergonomicAdequacyText(null)).not.toBe(ergonomicAdequacyText("adequate"));
  });

  it("os tons do badge saem da paleta existente e o ausente é neutro", () => {
    expect(ergonomicAdequacyTone("adequate")).toBe("green");
    expect(ergonomicAdequacyTone("inadequate")).toBe("red");
    expect(ergonomicAdequacyTone("not_applicable")).toBe("neutral");
    expect(ergonomicAdequacyTone(null)).toBe("neutral");
  });

  it("COPSOQ aparece só como sugestão de método, nunca como cálculo", () => {
    expect(ERGONOMIC_METHOD_SUGGESTIONS).toContain("COPSOQ");
  });
});

describe("ergonomics — schema de entrada", () => {
  it("aceita uma avaliação só com a data (avaliação parcial é válida)", () => {
    const parsed = ergonomicEvaluationInputSchema.parse(base());
    expect(parsed.assessedAt).toBe("2026-09-27");
    expect(parsed.posture).toBeUndefined();
    expect(parsed.psychosocialCampaignId).toBeUndefined();
  });

  it("exige a data da avaliação", () => {
    expect(() => ergonomicEvaluationInputSchema.parse({})).toThrow();
    expect(() => ergonomicEvaluationInputSchema.parse({ assessedAt: "" })).toThrow();
    expect(() =>
      ergonomicEvaluationInputSchema.parse({ assessedAt: "27/09/2026" }),
    ).toThrow();
  });

  it("recusa valor de adequação fora do enum", () => {
    expect(() =>
      ergonomicEvaluationInputSchema.parse(base({ posture: "excelente" })),
    ).toThrow();
    expect(() =>
      ergonomicEvaluationInputSchema.parse(base({ mentalLoad: "3" })),
    ).toThrow();
  });

  it("aceita os três estados em qualquer dimensão", () => {
    const parsed = ergonomicEvaluationInputSchema.parse(
      base({
        posture: "adequate",
        movements: "inadequate",
        physicalLoad: "not_applicable",
      }),
    );
    expect(parsed.posture).toBe("adequate");
    expect(parsed.movements).toBe("inadequate");
    expect(parsed.physicalLoad).toBe("not_applicable");
    expect(parsed.mentalLoad).toBeUndefined();
  });

  it("string vazia vira ausência (não vira estado declarado)", () => {
    const parsed = ergonomicEvaluationInputSchema.parse(
      base({ posture: "", postureNotes: "   ", responsible: "", method: "" }),
    );
    expect(parsed.posture).toBeUndefined();
    expect(parsed.postureNotes).toBeUndefined();
    expect(parsed.responsible).toBeUndefined();
    expect(parsed.method).toBeUndefined();
  });

  it("campanha psicossocial é opcional e precisa ser UUID quando informada", () => {
    expect(
      ergonomicEvaluationInputSchema.parse(base({ psychosocialCampaignId: CAMPAIGN }))
        .psychosocialCampaignId,
    ).toBe(CAMPAIGN);
    expect(
      ergonomicEvaluationInputSchema.parse(base({ psychosocialCampaignId: "" }))
        .psychosocialCampaignId,
    ).toBeUndefined();
    expect(() =>
      ergonomicEvaluationInputSchema.parse(base({ psychosocialCampaignId: "abc" })),
    ).toThrow();
  });

  it("não existe campo de conclusão geral no contrato de entrada", () => {
    const parsed = ergonomicEvaluationInputSchema.parse(
      base({ conclusion: "adequado", score: 4 }) as Record<string, unknown>,
    ) as Record<string, unknown>;
    expect(parsed.conclusion).toBeUndefined();
    expect(parsed.score).toBeUndefined();
  });

  it("limita o tamanho de responsável e método", () => {
    expect(() =>
      ergonomicEvaluationInputSchema.parse(base({ responsible: "x".repeat(256) })),
    ).toThrow();
    expect(() =>
      ergonomicEvaluationInputSchema.parse(base({ method: "y".repeat(256) })),
    ).toThrow();
  });
});

describe("ergonomics — vigência", () => {
  const row = (id: string, assessedAt: string, createdAt: string) => ({
    id,
    assessedAt,
    createdAt: new Date(createdAt),
  });

  it("vigente é a de maior assessed_at", () => {
    const list = [
      row("a", "2026-01-10", "2026-01-10T10:00:00Z"),
      row("b", "2026-06-01", "2026-01-11T10:00:00Z"),
      row("c", "2025-12-31", "2026-02-01T10:00:00Z"),
    ];
    expect(currentErgonomicEvaluation(list)?.id).toBe("b");
  });

  it("empate de data desempata pelo created_at mais recente", () => {
    const list = [
      row("a", "2026-06-01", "2026-06-01T08:00:00Z"),
      row("b", "2026-06-01", "2026-06-01T09:00:00Z"),
    ];
    expect(currentErgonomicEvaluation(list)?.id).toBe("b");
  });

  it("empate total desempata por id — resultado determinístico", () => {
    const same = "2026-06-01T09:00:00Z";
    const first = [row("a1", "2026-06-01", same), row("b2", "2026-06-01", same)];
    const reversed = [...first].reverse();
    expect(currentErgonomicEvaluation(first)?.id).toBe("b2");
    expect(currentErgonomicEvaluation(reversed)?.id).toBe("b2");
  });

  it("lista vazia não tem vigente", () => {
    expect(currentErgonomicEvaluation([])).toBeNull();
  });

  it("a ordenação não muta o array recebido", () => {
    const list = [
      row("a", "2026-01-01", "2026-01-01T00:00:00Z"),
      row("b", "2026-02-01", "2026-02-01T00:00:00Z"),
    ];
    currentErgonomicEvaluation(list);
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("comparador aceita created_at em string (linha crua do banco)", () => {
    const a = { id: "a", assessedAt: "2026-06-01", createdAt: "2026-06-01T08:00:00Z" };
    const b = { id: "b", assessedAt: "2026-06-01", createdAt: "2026-06-01T09:00:00Z" };
    expect(compareErgonomicEvaluations(a, b)).toBeGreaterThan(0);
  });
});

describe("ergonomics — leitura e resumo", () => {
  it("lista as seis dimensões com estado e observação", () => {
    const entries = listErgonomicDimensions({
      posture: "inadequate",
      postureNotes: "Bancada baixa",
      mentalLoad: "not_applicable",
    });
    expect(entries).toHaveLength(6);
    expect(entries[0]).toEqual({
      dimension: "posture",
      label: "Postura",
      adequacy: "inadequate",
      notes: "Bancada baixa",
    });
    const mental = entries.find((e) => e.dimension === "mentalLoad");
    expect(mental?.adequacy).toBe("not_applicable");
    const movements = entries.find((e) => e.dimension === "movements");
    expect(movements?.adequacy).toBeNull();
    expect(movements?.notes).toBeNull();
  });

  it("conta avaliadas e inadequadas sem virar nota", () => {
    const evaluation = {
      posture: "inadequate" as const,
      movements: "adequate" as const,
      physicalLoad: "inadequate" as const,
      mentalLoad: "not_applicable" as const,
    };
    expect(countAssessedDimensions(evaluation)).toBe(4);
    expect(countInadequateDimensions(evaluation)).toBe(2);
    expect(summarizeErgonomicDimensions(evaluation)).toBe(
      "4 de 6 avaliadas · 2 inadequadas",
    );
  });

  it("resume avaliação sem nenhuma dimensão e sem inadequação", () => {
    expect(summarizeErgonomicDimensions({})).toBe("Nenhuma dimensão avaliada");
    expect(summarizeErgonomicDimensions({ posture: "adequate" })).toBe(
      "1 de 6 avaliadas",
    );
    expect(summarizeErgonomicDimensions({ posture: "inadequate" })).toBe(
      "1 de 6 avaliadas · 1 inadequada",
    );
  });

  it("o estado vazio do risco é explícito", () => {
    expect(NO_ERGONOMIC_EVALUATION_LABEL).toBe("Sem avaliação ergonômica registrada");
  });
});

describe("ergonomics — agregado psicossocial", () => {
  it("o rótulo declara que é agregado da campanha e não menciona escore COPSOQ", () => {
    expect(PSYCHOSOCIAL_AGGREGATE_LABEL).toBe(
      "Resultado agregado da campanha psicossocial",
    );
    expect(PSYCHOSOCIAL_AGGREGATE_LABEL.toLowerCase()).not.toContain("copsoq");
    expect(PSYCHOSOCIAL_AGGREGATE_LABEL.toLowerCase()).not.toContain("escore");
  });

  it("formata o período da campanha e admite datas ausentes", () => {
    expect(formatCampaignPeriod("2026-01-01", "2026-03-31")).toBe(
      "2026-01-01 a 2026-03-31",
    );
    expect(formatCampaignPeriod("2026-01-01", null)).toBe("a partir de 2026-01-01");
    expect(formatCampaignPeriod(null, "2026-03-31")).toBe("até 2026-03-31");
    expect(formatCampaignPeriod(null, null)).toBeNull();
  });
});
