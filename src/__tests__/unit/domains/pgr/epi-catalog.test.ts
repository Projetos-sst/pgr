import { epiCatalogInputSchema } from "@/shared/domains/pgr/epi-catalog";

const CATEGORY_ID = "11111111-1111-1111-1111-1111111111a5";

describe("epiCatalogInputSchema (US1)", () => {
  const base = { type: "epi", categoryId: CATEGORY_ID, name: "Capacete" };

  it("aceita entrada mínima válida (opcionais → undefined)", () => {
    const parsed = epiCatalogInputSchema.parse(base);
    expect(parsed.type).toBe("epi");
    expect(parsed.categoryId).toBe(CATEGORY_ID);
    expect(parsed.name).toBe("Capacete");
    expect(parsed.ca).toBeUndefined();
    expect(parsed.caValidUntil).toBeUndefined();
    expect(parsed.norm).toBeUndefined();
    expect(parsed.photoPath).toBeUndefined();
  });

  it("aceita todos os opcionais preenchidos, incluindo caValidUntil ISO", () => {
    const parsed = epiCatalogInputSchema.parse({
      ...base,
      type: "machine",
      ca: "12345",
      caValidUntil: "2026-12-31",
      manufacturer: "ACME",
      norm: "NR-6",
      size: "G",
      unitOfMeasure: "par",
      description: "desc",
      photoPath: "/img/x.png",
    });
    expect(parsed.type).toBe("machine");
    expect(parsed.caValidUntil).toBe("2026-12-31");
    expect(parsed.norm).toBe("NR-6");
    expect(parsed.unitOfMeasure).toBe("par");
  });

  it("rejeita tipo fora de epi|machine", () => {
    expect(() => epiCatalogInputSchema.parse({ ...base, type: "ppe" })).toThrow();
  });

  it("exige categoryId (uuid) — ausente ou inválido rejeitado", () => {
    expect(() => epiCatalogInputSchema.parse({ type: "epi", name: "X" })).toThrow();
    expect(() =>
      epiCatalogInputSchema.parse({ ...base, categoryId: "nao-uuid" }),
    ).toThrow();
  });

  it("exige nome não-vazio (após trim)", () => {
    expect(() => epiCatalogInputSchema.parse({ ...base, name: "  " })).toThrow();
  });

  it("rejeita caValidUntil malformada / data impossível", () => {
    expect(() =>
      epiCatalogInputSchema.parse({ ...base, caValidUntil: "31/12/2026" }),
    ).toThrow();
    expect(() =>
      epiCatalogInputSchema.parse({ ...base, caValidUntil: "2026-13-45" }),
    ).toThrow();
  });

  it("normaliza opcionais vazios/espaços para undefined", () => {
    const parsed = epiCatalogInputSchema.parse({
      ...base,
      ca: "   ",
      caValidUntil: "",
      norm: "",
      size: "  ",
    });
    expect(parsed.ca).toBeUndefined();
    expect(parsed.caValidUntil).toBeUndefined();
    expect(parsed.norm).toBeUndefined();
    expect(parsed.size).toBeUndefined();
  });
});
