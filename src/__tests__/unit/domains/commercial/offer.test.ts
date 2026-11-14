import {
  currentOffers,
  isCommercialCatalogEnabledFor,
  isFictitiousCatalogAllowedFor,
  offerState,
  offerVersionInputSchema,
  sellableOffers,
} from "@/shared/domains/commercial/offer";
import { FICTITIOUS_CATALOG } from "@/shared/domains/commercial/fictitious-catalog";

const fictitious = {
  code: "ficticio-pgr",
  name: "PGR (catálogo fictício de teste)",
  description: "",
  scope: "company",
  currency: "BRL",
  billingPeriod: "monthly",
  items: [
    {
      service: "pgr",
      label: "PGR por empresa",
      unit: "company",
      unitAmountCents: 12345,
    },
  ],
  quotas: [{ metric: "employees", limit: 50 }],
  validFrom: "2026-11-01",
  validUntil: null,
  fictitious: true,
  approvalReference: null,
};
const approved = {
  ...fictitious,
  code: "pgr",
  fictitious: false,
  approvalReference: "Ata comercial de teste",
};
const issuePaths = (input: unknown) =>
  offerVersionInputSchema
    .safeParse(input)
    .error?.issues.map((issue) => issue.path.join(".")) ?? [];
const published = new Date("2026-11-02T12:00:00Z");
const version = (
  code: string,
  number: number,
  overrides: Partial<{
    publishedAt: Date | null;
    deactivatedAt: Date | null;
    validFrom: string;
    validUntil: string | null;
    fictitious: boolean;
  }> = {},
) => ({
  code,
  version: number,
  publishedAt: published,
  deactivatedAt: null,
  validFrom: "2026-11-01",
  validUntil: null,
  fictitious: true,
  ...overrides,
});

describe("versão de oferta comercial", () => {
  it("aceita oferta fictícia identificada pelo código e pela marca", () => {
    expect(offerVersionInputSchema.parse(fictitious)).toEqual(fictitious);
  });

  it("aceita oferta aprovada só com a referência da aprovação comercial", () => {
    expect(offerVersionInputSchema.parse(approved)).toEqual(approved);
    expect(issuePaths({ ...approved, approvalReference: null })).toEqual([
      "approvalReference",
    ]);
  });

  it("recusa oferta fictícia sem o prefixo e oferta real com o prefixo de fictícia", () => {
    expect(issuePaths({ ...fictitious, code: "pgr" })).toEqual(["code"]);
    expect(issuePaths({ ...approved, code: "ficticio-pgr" })).toEqual(["code"]);
  });

  it("recusa oferta fictícia que declara aprovação comercial", () => {
    expect(issuePaths({ ...fictitious, approvalReference: "Ata" })).toEqual([
      "approvalReference",
    ]);
  });

  it("recusa preço fracionado, negativo ou acima do teto, e moeda diferente de BRL", () => {
    const priced = (unitAmountCents: number) => ({
      ...fictitious,
      items: [{ ...fictitious.items[0], unitAmountCents }],
    });
    expect(issuePaths(priced(10.5))).toEqual(["items.0.unitAmountCents"]);
    expect(issuePaths(priced(-1))).toEqual(["items.0.unitAmountCents"]);
    expect(issuePaths(priced(100_000_001))).toEqual(["items.0.unitAmountCents"]);
    expect(issuePaths({ ...fictitious, currency: "USD" })).toEqual(["currency"]);
  });

  it("recusa oferta sem item, item repetido, cota repetida e vigência invertida", () => {
    expect(issuePaths({ ...fictitious, items: [] })).toEqual(["items"]);
    expect(
      issuePaths({ ...fictitious, items: [fictitious.items[0], fictitious.items[0]] }),
    ).toEqual(["items"]);
    expect(
      issuePaths({
        ...fictitious,
        quotas: [fictitious.quotas[0], fictitious.quotas[0]],
      }),
    ).toEqual(["quotas"]);
    expect(issuePaths({ ...fictitious, validUntil: "2026-10-31" })).toEqual([
      "validUntil",
    ]);
  });

  it("recusa campo desconhecido, como um preço total informado por fora", () => {
    expect(issuePaths({ ...fictitious, totalCents: 1 })).toEqual([""]);
  });
});

describe("estado da versão", () => {
  it("rascunho, agendada, à venda, vencida e desativada", () => {
    expect(offerState(version("a", 1, { publishedAt: null }), "2026-11-10")).toBe(
      "draft",
    );
    expect(offerState(version("a", 1, { validFrom: "2026-12-01" }), "2026-11-30")).toBe(
      "scheduled",
    );
    expect(offerState(version("a", 1), "2026-11-01")).toBe("on_sale");
    expect(offerState(version("a", 1, { validUntil: "2026-11-30" }), "2026-11-30")).toBe(
      "on_sale",
    );
    expect(offerState(version("a", 1, { validUntil: "2026-11-30" }), "2026-12-01")).toBe(
      "expired",
    );
    expect(offerState(version("a", 1, { deactivatedAt: published }), "2026-11-10")).toBe(
      "deactivated",
    );
  });
});

describe("oferta vigente por código", () => {
  it("a versão publicada mais nova substitui a anterior nas novas compras", () => {
    const offers = currentOffers(
      [version("b", 1), version("a", 1), version("a", 2)],
      "2026-11-10",
    );
    expect(offers.map((offer) => [offer.code, offer.version])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("versão agendada não substitui a vigente antes do início da vigência", () => {
    const versions = [version("a", 1), version("a", 2, { validFrom: "2026-12-01" })];
    expect(currentOffers(versions, "2026-11-30").map((o) => o.version)).toEqual([1]);
    expect(currentOffers(versions, "2026-12-01").map((o) => o.version)).toEqual([2]);
  });

  it("desativar a versão nova devolve a anterior que continua à venda", () => {
    const versions = [version("a", 1), version("a", 2, { deactivatedAt: published })];
    expect(currentOffers(versions, "2026-11-10").map((o) => o.version)).toEqual([1]);
  });

  it("rascunho e versão desativada nunca ficam à venda", () => {
    const versions = [
      version("a", 1, { deactivatedAt: published }),
      version("a", 2, { publishedAt: null }),
    ];
    expect(currentOffers(versions, "2026-11-10")).toEqual([]);
  });
});

describe("ambiente comercial", () => {
  it("a superfície comercial nasce desligada e só liga com a flag exata", () => {
    expect(isCommercialCatalogEnabledFor({})).toBe(false);
    expect(isCommercialCatalogEnabledFor({ COMMERCIAL_CATALOG_ENABLED: "1" })).toBe(
      false,
    );
    expect(isCommercialCatalogEnabledFor({ COMMERCIAL_CATALOG_ENABLED: "true" })).toBe(
      true,
    );
  });

  it("catálogo fictício nunca vale em produção nem com o ambiente indefinido", () => {
    expect(isFictitiousCatalogAllowedFor({})).toBe(false);
    expect(isFictitiousCatalogAllowedFor({ APP_ENV: " " })).toBe(false);
    expect(isFictitiousCatalogAllowedFor({ APP_ENV: "Production" })).toBe(false);
    expect(isFictitiousCatalogAllowedFor({ APP_ENV: "local" })).toBe(true);
    expect(isFictitiousCatalogAllowedFor({ APP_ENV: "sandbox" })).toBe(true);
  });

  it("em produção só a oferta aprovada fica à venda", () => {
    const versions = [
      version("ficticio-pgr", 1),
      version("pgr", 1, { fictitious: false }),
    ];
    expect(
      sellableOffers(versions, "2026-11-10", { APP_ENV: "production" }).map(
        (offer) => offer.code,
      ),
    ).toEqual(["pgr"]);
    expect(
      sellableOffers(versions, "2026-11-10", { APP_ENV: "local" }).map(
        (offer) => offer.code,
      ),
    ).toEqual(["ficticio-pgr", "pgr"]);
  });
});

describe("catálogo fictício", () => {
  it("toda oferta do catálogo de teste é válida e marcada como fictícia", () => {
    expect(FICTITIOUS_CATALOG.length).toBeGreaterThan(0);
    for (const offer of FICTITIOUS_CATALOG) {
      expect(offerVersionInputSchema.parse(offer)).toEqual(offer);
      expect(offer.fictitious).toBe(true);
      expect(offer.approvalReference).toBeNull();
      expect(offer.name).toContain("fictício");
    }
  });

  it("cobre PGR, Medicina, os dois juntos, Pro e avulso, sem repetir código", () => {
    const codes = FICTITIOUS_CATALOG.map((offer) => offer.code);
    expect(new Set(codes).size).toBe(codes.length);
    const services = FICTITIOUS_CATALOG.map((offer) =>
      offer.items
        .map((item) => item.service)
        .sort()
        .join("+"),
    ).sort();
    expect(services).toEqual(["medicine", "medicine+pgr", "one_off", "pgr", "pro"]);
  });
});
