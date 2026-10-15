import { categoryInputSchema } from "@/shared/domains/pgr/categories";

describe("categoryInputSchema (US1)", () => {
  const base = { type: "epi", name: "Luva" };

  it("aceita entrada mínima válida (note opcional)", () => {
    const parsed = categoryInputSchema.parse(base);
    expect(parsed.type).toBe("epi");
    expect(parsed.name).toBe("Luva");
    expect(parsed.note).toBeUndefined();
  });

  it("aceita type machine e note preenchida", () => {
    const parsed = categoryInputSchema.parse({
      type: "machine",
      name: "Betoneira",
      note: "uso restrito",
    });
    expect(parsed.type).toBe("machine");
    expect(parsed.note).toBe("uso restrito");
  });

  it("aceita type supply (Insumo, #192)", () => {
    expect(categoryInputSchema.parse({ type: "supply", name: "Cimento" }).type).toBe(
      "supply",
    );
  });

  it("rejeita tipo fora de epi|machine|supply", () => {
    expect(() => categoryInputSchema.parse({ ...base, type: "ppe" })).toThrow();
  });

  it("isActive default true; aceita 'false' (form) e boolean (JSON)", () => {
    expect(categoryInputSchema.parse(base).isActive).toBe(true);
    expect(categoryInputSchema.parse({ ...base, isActive: "false" }).isActive).toBe(
      false,
    );
    expect(categoryInputSchema.parse({ ...base, isActive: true }).isActive).toBe(true);
  });

  it("exige nome não-vazio (após trim)", () => {
    expect(() => categoryInputSchema.parse({ ...base, name: "  " })).toThrow();
    expect(() => categoryInputSchema.parse({ type: "epi" })).toThrow();
  });

  it("trata note vazia/espaços como undefined", () => {
    expect(categoryInputSchema.parse({ ...base, note: "   " }).note).toBeUndefined();
  });
});
