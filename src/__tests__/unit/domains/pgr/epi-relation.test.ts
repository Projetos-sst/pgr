/**
 * Relação de EPIs derivada do PGR (#48): deduplicação por item de catálogo, contextos
 * (risco/GES) preservados, situação do CA e formatação das especificações reais.
 */
import {
  EPI_CA_DUE_WINDOW_DAYS,
  EPI_RELATION_EMPTY_LABEL,
  EPI_RELATION_SOURCE_NOTE,
  classifyEpiCaValidity,
  derivePgrEpiRelation,
  epiCaStatusLabel,
  epiCaStatusTone,
  formatEpiSpecs,
  type PgrEpiRelationItem,
} from "@/shared/domains/pgr/epi-relation";
import type {
  ConsolidatedEpi,
  ConsolidatedGes,
  ConsolidatedRisk,
  PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";

const TODAY = "2026-09-27";

function epi(overrides: Partial<ConsolidatedEpi> = {}): ConsolidatedEpi {
  return {
    id: "link-1",
    catalogId: "cat-1",
    name: "Protetor auricular",
    ca: "12345",
    neutralization: "neutralizes",
    caValidUntil: "2027-01-31",
    manufacturer: "Acme EPI",
    norm: "ABNT NBR 16077",
    material: "Silicone",
    size: "Único",
    unitOfMeasure: "par",
    usefulLifeMonths: 12,
    description: "Plug de inserção",
    ...overrides,
  };
}

function risk(
  id: string,
  description: string,
  epis: ConsolidatedEpi[],
): ConsolidatedRisk {
  return {
    id,
    agentType: "physical",
    description,
    hazard: null,
    sources: null,
    propagation: null,
    exposureTime: null,
    possibleInjuries: null,
    noxiousAgentCode: null,
    measurementUnit: null,
    concentrationIntensity: null,
    riskLevel: null,
    result: null,
    assessment: null,
    measures: [],
    planCoverage: "not_assessed",
    epis,
  };
}

function pgr(ges: ConsolidatedGes[]): PgrConsolidated {
  return {
    pgr: {
      id: "pgr-1",
      companyName: "ACME Ltda",
      workUnitName: "Obra Central",
      responsible: null,
      registrationType: "not_applicable",
      registrationNumber: null,
      issuedAt: null,
      validUntil: null,
    },
    ges,
  };
}

function names(items: PgrEpiRelationItem[]): string[] {
  return items.map((i) => i.name);
}

describe("relação de EPIs — validade do CA", () => {
  it("usa a janela de 30 dias que já existia no projeto", () => {
    expect(EPI_CA_DUE_WINDOW_DAYS).toBe(30);
  });

  it("classifica vencido, a vencer, válido e sem validade informada", () => {
    const opts = { today: TODAY };
    expect(classifyEpiCaValidity("2026-09-26", opts)).toBe("expired");
    expect(classifyEpiCaValidity("2026-09-27", opts)).toBe("due_soon"); // vence hoje
    expect(classifyEpiCaValidity("2026-10-27", opts)).toBe("due_soon"); // limite inclusivo
    expect(classifyEpiCaValidity("2026-10-28", opts)).toBe("valid");
    expect(classifyEpiCaValidity(null, opts)).toBe("no_expiry");
    expect(classifyEpiCaValidity(undefined, opts)).toBe("no_expiry");
  });

  it("validade ausente é estado próprio, não 'válido' nem 'vencido'", () => {
    expect(epiCaStatusLabel("no_expiry")).toBe("Validade não informada");
    expect(epiCaStatusTone("no_expiry")).toBe("neutral");
    expect(epiCaStatusTone("valid")).toBe("green");
    expect(epiCaStatusTone("due_soon")).toBe("amber");
    expect(epiCaStatusTone("expired")).toBe("red");
  });
});

describe("relação de EPIs — derivação", () => {
  it("PGR sem GES ou sem EPI devolve lista vazia", () => {
    expect(derivePgrEpiRelation(pgr([]), { today: TODAY })).toEqual([]);
    expect(
      derivePgrEpiRelation(
        pgr([{ id: "g1", name: "GES 1", risks: [risk("r1", "Ruído", [])] }]),
        { today: TODAY },
      ),
    ).toEqual([]);
  });

  it("deduplica por item de catálogo, preservando todos os contextos", () => {
    const data = pgr([
      {
        id: "g1",
        name: "Produção",
        risks: [
          risk("r1", "Ruído contínuo", [epi()]),
          risk("r2", "Ruído de impacto", [epi({ id: "link-2" })]),
        ],
      },
      {
        id: "g2",
        name: "Manutenção",
        risks: [risk("r3", "Ruído em oficina", [epi({ id: "link-3" })])],
      },
    ]);
    const items = derivePgrEpiRelation(data, { today: TODAY });
    expect(items).toHaveLength(1);
    expect(items[0].contexts).toHaveLength(3);
    expect(items[0].contexts.map((c) => c.riskDescription)).toEqual([
      "Ruído contínuo",
      "Ruído de impacto",
      "Ruído em oficina",
    ]);
    expect(items[0].gesNames).toEqual(["Produção", "Manutenção"]);
  });

  it("EPIs diferentes viram linhas diferentes, ordenadas por nome", () => {
    const data = pgr([
      {
        id: "g1",
        name: "Produção",
        risks: [
          risk("r1", "Ruído", [
            epi({ catalogId: "cat-2", name: "Óculos de proteção" }),
            epi({ catalogId: "cat-1", name: "Abafador" }),
          ]),
        ],
      },
    ]);
    expect(names(derivePgrEpiRelation(data, { today: TODAY }))).toEqual([
      "Abafador",
      "Óculos de proteção",
    ]);
  });

  it("traz os campos técnicos do cadastro, sem inventar nada", () => {
    const data = pgr([
      { id: "g1", name: "Produção", risks: [risk("r1", "Ruído", [epi()])] },
    ]);
    const [item] = derivePgrEpiRelation(data, { today: TODAY });
    expect(item).toMatchObject({
      catalogId: "cat-1",
      name: "Protetor auricular",
      ca: "12345",
      caValidUntil: "2027-01-31",
      manufacturer: "Acme EPI",
      norm: "ABNT NBR 16077",
      material: "Silicone",
      size: "Único",
      unitOfMeasure: "par",
      usefulLifeMonths: 12,
      description: "Plug de inserção",
      caStatus: "valid",
    });
  });

  it("campo ausente continua ausente (null), sem preencher com placeholder", () => {
    const data = pgr([
      {
        id: "g1",
        name: "Produção",
        risks: [
          risk("r1", "Ruído", [
            {
              id: "l1",
              catalogId: "cat-9",
              name: "EPI mínimo",
              ca: null,
              neutralization: "not_applicable",
            },
          ]),
        ],
      },
    ]);
    const [item] = derivePgrEpiRelation(data, { today: TODAY });
    expect(item.ca).toBeNull();
    expect(item.manufacturer).toBeNull();
    expect(item.usefulLifeMonths).toBeNull();
    expect(item.caStatus).toBe("no_expiry");
    expect(formatEpiSpecs(item)).toBeNull();
  });

  it("marca CA vencido e a vencer com a data real do cadastro", () => {
    const data = pgr([
      {
        id: "g1",
        name: "Produção",
        risks: [
          risk("r1", "Ruído", [
            epi({ catalogId: "cat-v", name: "Vencido", caValidUntil: "2026-01-01" }),
            epi({ catalogId: "cat-d", name: "A vencer", caValidUntil: "2026-10-05" }),
          ]),
        ],
      },
    ]);
    const items = derivePgrEpiRelation(data, { today: TODAY });
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName["Vencido"].caStatus).toBe("expired");
    expect(byName["A vencer"].caStatus).toBe("due_soon");
  });

  it("formata as especificações só com o que existe", () => {
    const data = pgr([
      { id: "g1", name: "Produção", risks: [risk("r1", "Ruído", [epi()])] },
    ]);
    const [item] = derivePgrEpiRelation(data, { today: TODAY });
    expect(formatEpiSpecs(item)).toBe(
      "Silicone · Tam. Único · par · 12 mês(es) de vida útil",
    );
  });

  it("não muta a visão consolidada recebida", () => {
    const data = pgr([
      { id: "g1", name: "Produção", risks: [risk("r1", "Ruído", [epi()])] },
    ]);
    const snapshot = JSON.stringify(data);
    derivePgrEpiRelation(data, { today: TODAY });
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it("os textos de origem e de vazio deixam claro que o dado vem do cadastro", () => {
    expect(EPI_RELATION_SOURCE_NOTE).toContain("cadastro de EPIs");
    expect(EPI_RELATION_EMPTY_LABEL).toContain("Nenhum EPI");
  });
});
