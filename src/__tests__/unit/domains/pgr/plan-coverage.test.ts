import {
  isMeasureMissingRequiredPlanFields,
  isModeratePlusClassification,
} from "@/shared/domains/pgr/control-measure";
import { RISK_CLASSIFICATION_ORDER } from "@/shared/domains/pgr/methodology";
import {
  deriveRiskPlanCoverage,
  planCoverageGuidance,
  planCoverageLabel,
  RISK_PLAN_COVERAGES,
  summarizePlanCoverage,
  type PlanCoverageMeasure,
} from "@/shared/domains/pgr/plan-coverage";

function measure(overrides: Partial<PlanCoverageMeasure> = {}): PlanCoverageMeasure {
  return {
    applicable: true,
    status: null,
    actionResponsible: "SESMT",
    actionDeadline: "2026-12-31",
    ...overrides,
  };
}

describe("grupos de classificação (#42)", () => {
  it("grupo A = trivial/tolerável; grupo B = moderado/substancial/intolerável", () => {
    const groupB = RISK_CLASSIFICATION_ORDER.filter((c) =>
      isModeratePlusClassification(c),
    );
    const groupA = RISK_CLASSIFICATION_ORDER.filter(
      (c) => !isModeratePlusClassification(c),
    );
    expect(groupA).toEqual(["trivial", "tolerable"]);
    expect(groupB).toEqual(["moderate", "substantial", "intolerable"]);
  });
});

describe("isMeasureMissingRequiredPlanFields — regra única", () => {
  it("moderado+ e aplicável sem responsável ou sem prazo → faltando", () => {
    expect(
      isMeasureMissingRequiredPlanFields(
        measure({ actionResponsible: null }),
        "moderate",
      ),
    ).toBe(true);
    expect(
      isMeasureMissingRequiredPlanFields(measure({ actionDeadline: "" }), "intolerable"),
    ).toBe(true);
  });

  it("moderado+ com os dois campos → completo", () => {
    expect(isMeasureMissingRequiredPlanFields(measure(), "substantial")).toBe(false);
  });

  it("medida não aplicável nunca exige os campos", () => {
    expect(
      isMeasureMissingRequiredPlanFields(
        measure({ applicable: false, actionResponsible: null, actionDeadline: null }),
        "intolerable",
      ),
    ).toBe(false);
  });

  it("grupo A e risco sem avaliação não exigem os campos", () => {
    const empty = measure({ actionResponsible: null, actionDeadline: null });
    expect(isMeasureMissingRequiredPlanFields(empty, "tolerable")).toBe(false);
    expect(isMeasureMissingRequiredPlanFields(empty, "trivial")).toBe(false);
    expect(isMeasureMissingRequiredPlanFields(empty, null)).toBe(false);
  });
});

describe("deriveRiskPlanCoverage", () => {
  it("sem classificação vigente → not_assessed (mesmo com medidas)", () => {
    expect(deriveRiskPlanCoverage({ result: null, measures: [] })).toBe("not_assessed");
    expect(deriveRiskPlanCoverage({ result: null, measures: [measure()] })).toBe(
      "not_assessed",
    );
  });

  it("avaliado sem nenhuma medida → no_measure (o risco aparece no plano mesmo assim)", () => {
    expect(deriveRiskPlanCoverage({ result: "trivial", measures: [] })).toBe(
      "no_measure",
    );
    expect(deriveRiskPlanCoverage({ result: "intolerable", measures: [] })).toBe(
      "no_measure",
    );
  });

  it("moderado+ com medida aplicável sem responsável/prazo → incomplete", () => {
    expect(
      deriveRiskPlanCoverage({
        result: "moderate",
        measures: [measure(), measure({ actionDeadline: null })],
      }),
    ).toBe("incomplete");
  });

  it("grupo A com medida mantida sem prazo/responsável → covered", () => {
    expect(
      deriveRiskPlanCoverage({
        result: "tolerable",
        measures: [
          measure({ status: "maintain", actionResponsible: null, actionDeadline: null }),
        ],
      }),
    ).toBe("covered");
  });

  it("moderado+ só com medidas não aplicáveis → covered (espelha a regra de escrita)", () => {
    expect(
      deriveRiskPlanCoverage({
        result: "substantial",
        measures: [
          measure({ applicable: false, actionResponsible: null, actionDeadline: null }),
        ],
      }),
    ).toBe("covered");
  });
});

describe("reclassificação não muda dados — só a cobertura derivada", () => {
  const humanMeasure = measure({
    status: "maintain",
    actionResponsible: null,
    actionDeadline: null,
  });

  it("tolerável → moderado: a mesma medida passa a deixar o risco incomplete", () => {
    expect(
      deriveRiskPlanCoverage({ result: "tolerable", measures: [humanMeasure] }),
    ).toBe("covered");
    expect(deriveRiskPlanCoverage({ result: "moderate", measures: [humanMeasure] })).toBe(
      "incomplete",
    );
    // a medida em si não foi tocada
    expect(humanMeasure).toEqual({
      applicable: true,
      status: "maintain",
      actionResponsible: null,
      actionDeadline: null,
    });
  });

  it("moderado → tolerável: dados preservados e o risco continua coberto", () => {
    const introduced = measure({ status: "introduced" });
    expect(deriveRiskPlanCoverage({ result: "moderate", measures: [introduced] })).toBe(
      "covered",
    );
    expect(deriveRiskPlanCoverage({ result: "tolerable", measures: [introduced] })).toBe(
      "covered",
    );
    expect(introduced.status).toBe("introduced");
    expect(introduced.actionResponsible).toBe("SESMT");
    expect(introduced.actionDeadline).toBe("2026-12-31");
  });
});

describe("summarizePlanCoverage e rótulos", () => {
  it("conta por cobertura com zero-fill", () => {
    expect(
      summarizePlanCoverage([
        { planCoverage: "covered" },
        { planCoverage: "covered" },
        { planCoverage: "incomplete" },
      ]),
    ).toEqual({ not_assessed: 0, no_measure: 0, incomplete: 1, covered: 2 });
    expect(summarizePlanCoverage([])).toEqual({
      not_assessed: 0,
      no_measure: 0,
      incomplete: 0,
      covered: 0,
    });
  });

  it("toda cobertura tem rótulo e orientação", () => {
    for (const coverage of RISK_PLAN_COVERAGES) {
      expect(planCoverageLabel(coverage)).not.toBe("");
      expect(planCoverageGuidance(coverage)).not.toBe("");
    }
    expect(planCoverageLabel("incomplete")).toBe("Incompleto");
  });
});
