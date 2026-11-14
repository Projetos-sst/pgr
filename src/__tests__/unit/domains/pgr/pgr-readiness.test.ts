import { checkPgrReadiness } from "@/shared/domains/pgr/pgr-readiness";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import type {
  PgrConsolidated,
  ConsolidatedRisk,
} from "@/shared/domains/pgr/pgr-consolidated";
import type { PgrDocxExtras } from "@/shared/domains/pgr/pgr-docx/from-consolidated";
const address = {
  zipCode: null,
  street: null,
  number: null,
  complement: null,
  district: null,
  city: null,
  state: null,
};
const data: PgrConsolidated = {
  pgr: {
    id: "pgr",
    companyName: "Empresa fictícia",
    workUnitName: "Obra",
    responsible: "Profissional declarado",
    registrationType: "crea",
    registrationNumber: "123",
    issuedAt: "2026-01-01",
    validUntil: "2027-01-01",
    company: {
      razaoSocial: "Empresa fictícia",
      nomeFantasia: null,
      cnpj: "11222333000181",
      cnae: null,
      mainActivity: null,
      riskGrade: null,
      website: null,
      address,
    },
  },
  ges: [{ id: "ges", name: "Ambiente", risks: [] }],
};
const extras: PgrDocxExtras = {
  company: { phone: null, logoPath: null },
  revisions: [],
  requiredTrainings: [],
  ges: {
    ges: {
      processDescription: "Processo observado",
      constructionType: null,
      ceilingHeight: null,
      floor: null,
      roof: null,
      lighting: null,
      ventilation: null,
      otherCharacteristics: null,
      jobRoles: [
        {
          id: "role",
          title: "Função",
          description: "Atividade",
          workSchedule: null,
          workerCount: 1,
        },
      ],
    },
  },
};
const bands = defaultRiskMethodology().classificationBands;
const run = (d = data, e = extras) => checkPgrReadiness(d, e, bands);
it("does not infer absence of risks as a technical clearance", () => {
  const r = run();
  expect(r.ready).toBe(true);
  expect(r.issues).toContainEqual(
    expect.objectContaining({ code: "no_risks", severity: "warning" }),
  );
  expect(r.notice).toContain("Não substitui");
});
it("identifies missing identity, validity and exposure context with actionable locations", () => {
  const r = run(
    {
      ...data,
      pgr: {
        ...data.pgr,
        responsible: null,
        validUntil: null,
        company: { ...data.pgr.company!, cnpj: "invalid" },
      },
    },
    { ...extras, ges: {} },
  );
  expect(r.ready).toBe(false);
  expect(r.issues.map((i) => i.code)).toEqual(
    expect.arrayContaining([
      "responsible",
      "validity",
      "company_cnpj",
      "process_description",
      "no_job_roles",
    ]),
  );
  expect(r.issues.every((i) => i.href.startsWith("/"))).toBe(true);
});
function risk(): ConsolidatedRisk {
  return {
    id: "risk",
    agentType: "ergonomic",
    description: "Postura",
    hazard: "Posição",
    sources: "Bancada",
    propagation: null,
    exposureTime: "eventual",
    possibleInjuries: "Informação declarada",
    noxiousAgentCode: null,
    measurementUnit: null,
    concentrationIntensity: null,
    riskLevel: 4,
    result: "trivial",
    assessment: {
      criterion: "qualitative",
      probability: 2,
      severity: 2,
      riskLevel: 4,
      uncertaintyDegree: 0,
      toleranceLimit: null,
      result: "trivial",
      assessedAt: "2026-01-01",
      evaluationMethod: null,
      measuredValue: null,
      measuredUnit: null,
      toleranceLimitValue: null,
      nr09Conclusion: null,
    },
    measures: [],
    planCoverage: "no_measure",
    epis: [],
  };
}
it("detects the reference's 2x2 classification mismatch instead of encoding it", () => {
  const r = run({ ...data, ges: [{ ...data.ges[0], risks: [risk()] }] });
  expect(r.issues.map((i) => i.code)).toEqual(
    expect.arrayContaining(["classification_changed", "plan_incomplete"]),
  );
});
it("blocks missing assessments and incomplete quantitative readings", () => {
  const base = risk();
  expect(
    run({
      ...data,
      ges: [{ ...data.ges[0], risks: [{ ...base, assessment: null }] }],
    }).issues.map((i) => i.code),
  ).toContain("assessment_missing");
  expect(
    run({
      ...data,
      ges: [
        {
          ...data.ges[0],
          risks: [
            {
              ...base,
              agentType: "physical",
              assessment: base.assessment && {
                ...base.assessment,
                criterion: "quantitative",
              },
            },
          ],
        },
      ],
    }).issues.map((i) => i.code),
  ).toContain("measurement_incomplete");
});

const withRisk = (overrides: Partial<ConsolidatedRisk>) =>
  run({ ...data, ges: [{ ...data.ges[0], risks: [{ ...risk(), ...overrides }] }] });

it.each<ConsolidatedRisk["agentType"]>([
  "ergonomic",
  "mechanical",
  "accident",
  "psychosocial",
])(
  "does not require quantitative fields for the %s group, which admits no measurement",
  (agentType) => {
    const base = risk();
    const codes = withRisk({
      agentType,
      assessment: base.assessment && { ...base.assessment, criterion: "quantitative" },
    }).issues.map((i) => i.code);
    expect(codes).not.toContain("measurement_incomplete");
  },
);

it("keeps a legacy unit outside the catalog valid and readable, with a warning only", () => {
  const legacy = withRisk({
    agentType: "chemical",
    hazard: "Tinta",
    measurementUnit: "lux",
  });
  const usual = withRisk({
    agentType: "chemical",
    hazard: "Tinta",
    measurementUnit: "ppm",
  });
  const notice = legacy.issues.filter((i) => i.code === "unit_outside_catalog");
  expect(notice).toEqual([
    expect.objectContaining({
      severity: "warning",
      href: "/risks/risk/edit",
      message: expect.stringContaining(
        "A unidade lux não está entre as usuais do grupo Químico",
      ),
    }),
  ]);
  expect(legacy.blockingCount).toBe(usual.blockingCount);
  expect(usual.issues.map((i) => i.code)).not.toContain("unit_outside_catalog");
});
