import {
  MAX_EPI_CATALOG_OPTIONS,
  MAX_EPI_FILL_LINKS,
  acceptEpiRiskFillInputSchema,
  capEpiCatalog,
  keepCatalogLinks,
  parseModelEpiLinks,
  type SuggestedEpiLink,
} from "@/shared/domains/pgr/ai-epi-risk-fill";
import type { EpiOption } from "@/shared/domains/pgr/epi-risk";

const ID_A = "11111111-1111-4111-8111-1111111111a1";
const ID_B = "11111111-1111-4111-8111-1111111111a2";

const catalog: EpiOption[] = [
  { catalogId: ID_A, name: "Protetor auricular plug", ca: "12345" },
  { catalogId: ID_B, name: "Luva nitrílica", ca: null },
];

describe("parseModelEpiLinks", () => {
  it("aceita envelope { links } e array cru", () => {
    const link = { catalogId: ID_A, neutralization: "neutralizes" };
    expect(parseModelEpiLinks({ links: [link] })).toHaveLength(1);
    expect(parseModelEpiLinks([link])).toHaveLength(1);
  });

  it.each([
    ["Sim", "neutralizes"],
    ["Não", "does_not_neutralize"],
    ["não aplicável", "not_applicable"],
    ["N/A", "not_applicable"],
  ])("traduz a neutralização %s para %s", (input, expected) => {
    const [link] = parseModelEpiLinks({
      links: [{ catalogId: ID_A, neutralization: input }],
    });
    expect(link?.neutralization).toBe(expected);
  });

  it("descarta item inválido e EPI repetido sem derrubar o lote", () => {
    const out = parseModelEpiLinks({
      links: [
        { catalogId: ID_A, neutralization: "talvez" },
        {
          catalogId: ID_B,
          neutralization: "neutralizes",
          rationale: "Contato com solvente",
        },
        { catalogId: ID_B, neutralization: "does_not_neutralize" },
      ],
    });
    expect(out).toEqual([
      {
        catalogId: ID_B,
        neutralization: "neutralizes",
        rationale: "Contato com solvente",
      },
    ]);
  });

  it("trata formato inesperado como resultado vazio", () => {
    expect(parseModelEpiLinks(null)).toEqual([]);
    expect(parseModelEpiLinks({ nada: true })).toEqual([]);
  });
});

describe("keepCatalogLinks", () => {
  it("descarta EPI fora do catálogo enviado e completa nome e CA", () => {
    const out = keepCatalogLinks(
      [
        { catalogId: "inventado", neutralization: "neutralizes" },
        { catalogId: ID_A, neutralization: "neutralizes" },
      ],
      catalog,
    );
    expect(out).toEqual([
      {
        catalogId: ID_A,
        neutralization: "neutralizes",
        name: "Protetor auricular plug",
        ca: "12345",
      },
    ]);
  });

  it(`devolve no máximo ${MAX_EPI_FILL_LINKS} vínculos`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      catalogId: `id-${i}`,
      name: `EPI ${i}`,
      ca: null,
    }));
    const links: SuggestedEpiLink[] = many.map((c) => ({
      catalogId: c.catalogId,
      neutralization: "neutralizes",
    }));
    expect(keepCatalogLinks(links, many)).toHaveLength(MAX_EPI_FILL_LINKS);
  });
});

describe("capEpiCatalog", () => {
  it(`limita o catálogo enviado à IA a ${MAX_EPI_CATALOG_OPTIONS} itens`, () => {
    const big = Array.from({ length: 120 }, (_, i) => ({
      catalogId: `id-${i}`,
      name: `EPI ${i}`,
      ca: null,
    }));
    expect(capEpiCatalog(big)).toHaveLength(MAX_EPI_CATALOG_OPTIONS);
  });
});

describe("acceptEpiRiskFillInputSchema", () => {
  it("aceita os vínculos revisados", () => {
    expect(
      acceptEpiRiskFillInputSchema.safeParse({
        links: [{ catalogId: ID_A, neutralization: "not_applicable" }],
      }).success,
    ).toBe(true);
  });

  it("recusa lista vazia, EPI repetido e neutralização inválida", () => {
    expect(acceptEpiRiskFillInputSchema.safeParse({ links: [] }).success).toBe(false);
    expect(
      acceptEpiRiskFillInputSchema.safeParse({
        links: [
          { catalogId: ID_A, neutralization: "neutralizes" },
          { catalogId: ID_A, neutralization: "not_applicable" },
        ],
      }).success,
    ).toBe(false);
    expect(
      acceptEpiRiskFillInputSchema.safeParse({
        links: [{ catalogId: ID_A, neutralization: "talvez" }],
      }).success,
    ).toBe(false);
  });
});
