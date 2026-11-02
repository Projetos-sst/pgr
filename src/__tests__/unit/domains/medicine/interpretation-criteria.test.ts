/**
 * Critérios de interpretação e condutas (NOB-153, NR-7 7.5.4 c): entrada do médico, cobertura dos
 * exames do plano aprovado e composição do PCMSO com critério ou pendência. Fictício.
 */
import {
  criteriaCoverage,
  interpretationCriteriaInputSchema,
  type CurrentCriterion,
} from "@/shared/domains/medicine/interpretation-criteria";

const criterion = (overrides: Partial<CurrentCriterion> = {}): CurrentCriterion => ({
  id: "k1",
  procedureCode: "0281",
  otherDescription: null,
  version: 2,
  criteria: "Critério fictício do coordenador.",
  conduct: "Conduta fictícia do coordenador.",
  authorName: "Dra. Coordenadora",
  authoredAt: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

describe("interpretationCriteriaInputSchema", () => {
  it("exige critério e conduta com texto; código da Tabela 27; 9999 com descrição", () => {
    const ok = { code: "0281", criteria: "Texto.", conduct: "Texto." };
    expect(interpretationCriteriaInputSchema.safeParse(ok).success).toBe(true);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, criteria: "   " }).success,
    ).toBe(false);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, conduct: undefined }).success,
    ).toBe(false);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, code: "12" }).success,
    ).toBe(false);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, code: "9999" }).success,
    ).toBe(false);
    expect(
      interpretationCriteriaInputSchema.safeParse({
        ...ok,
        code: "9999",
        otherDescription: "Exame fictício",
      }).success,
    ).toBe(true);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, criteria: "x".repeat(5001) })
        .success,
    ).toBe(false);
    expect(
      interpretationCriteriaInputSchema.safeParse({ ...ok, suggestion: "IA" }).success,
    ).toBe(false);
  });
});

describe("criteriaCoverage", () => {
  it("exames do plano sem repetir, com o vigente ou pendentes; extras fora do plano", () => {
    const { rows, missing } = criteriaCoverage(
      [
        { procedureCode: "0281", otherDescription: null },
        { procedureCode: "0281", otherDescription: null },
        { procedureCode: "9999", otherDescription: "Exame fictício" },
      ],
      [criterion(), criterion({ id: "k2", procedureCode: "1057" })],
    );
    expect(
      rows.map((r) => [r.procedureCode, r.inApprovedPlan, r.current?.version ?? null]),
    ).toEqual([
      ["0281", true, 2],
      ["9999", true, null],
      ["1057", false, 2],
    ]);
    expect(missing).toEqual([{ procedureCode: "9999", description: "Exame fictício" }]);
  });

  it("9999 casa pela descrição, sem diferenciar maiúsculas", () => {
    const { missing } = criteriaCoverage(
      [{ procedureCode: "9999", otherDescription: "Exame Fictício" }],
      [criterion({ procedureCode: "9999", otherDescription: " exame fictício " })],
    );
    expect(missing).toEqual([]);
  });
});
