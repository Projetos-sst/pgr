import {
  epiCatalogInputSchema,
  summarizeEpiCatalogChanges,
  EPI_CATALOG_CREATED_SUMMARY,
  type EpiCatalogAuditSnapshot,
} from "@/shared/domains/pgr/epi-catalog";

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

  it("aceita replacementDate ISO opcional (issue #24) — mesmo padrão de caValidUntil", () => {
    const withDate = epiCatalogInputSchema.parse({
      ...base,
      replacementDate: "2027-06-30",
    });
    expect(withDate.replacementDate).toBe("2027-06-30");

    const withoutDate = epiCatalogInputSchema.parse(base);
    expect(withoutDate.replacementDate).toBeUndefined();

    expect(() =>
      epiCatalogInputSchema.parse({ ...base, replacementDate: "31/12/2027" }),
    ).toThrow();
  });
});

describe("summarizeEpiCatalogChanges (US1/issue #25)", () => {
  const snapshot = (
    patch: Partial<EpiCatalogAuditSnapshot> = {},
  ): EpiCatalogAuditSnapshot => ({
    type: "epi",
    categoryId: "11111111-1111-1111-1111-1111111111a5",
    name: "Capacete",
    ca: "12345",
    caValidUntil: "2026-12-31",
    manufacturer: "ACME",
    norm: "NR-6",
    size: "G",
    unitOfMeasure: "unidade",
    description: null,
    photoPath: null,
    replacementDate: null,
    ...patch,
  });

  it("descreve cada campo alterado com valor antigo e novo", () => {
    const before = snapshot();
    const after = snapshot({ name: "Capacete G", size: "GG" });
    const summary = summarizeEpiCatalogChanges(before, after);
    expect(summary).toContain('nome de "Capacete" para "Capacete G"');
    expect(summary).toContain('tamanho de "G" para "GG"');
    expect(summary.startsWith("Alterou ")).toBe(true);
  });

  it("resolve categoryId para o nome legível quando informado", () => {
    const before = snapshot({ categoryId: "cat-old" });
    const after = snapshot({ categoryId: "cat-new" });
    const summary = summarizeEpiCatalogChanges(before, after, {
      old: "Capacetes",
      new: "Luvas",
    });
    expect(summary).toContain('categoria de "Capacetes" para "Luvas"');
  });

  it("usa o rótulo pt-BR do tipo (EPI / Máquinas e Equipamentos)", () => {
    const before = snapshot({ type: "epi" });
    const after = snapshot({ type: "machine" });
    const summary = summarizeEpiCatalogChanges(before, after);
    expect(summary).toContain('tipo de "EPI" para "Máquinas e Equipamentos"');
  });

  it("sem diferenças → mensagem neutra, sem 'Alterou'", () => {
    const same = snapshot();
    expect(summarizeEpiCatalogChanges(same, snapshot())).toBe(
      "Item salvo sem alterações de dados.",
    );
  });

  it("EPI_CATALOG_CREATED_SUMMARY é o resumo fixo do create", () => {
    expect(EPI_CATALOG_CREATED_SUMMARY).toBe("Item cadastrado.");
  });
});
