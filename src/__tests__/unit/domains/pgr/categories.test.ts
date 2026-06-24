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

  it("rejeita tipo fora de epi|machine", () => {
    expect(() => categoryInputSchema.parse({ ...base, type: "ppe" })).toThrow();
  });

  it("exige nome não-vazio (após trim)", () => {
    expect(() => categoryInputSchema.parse({ ...base, name: "  " })).toThrow();
    expect(() => categoryInputSchema.parse({ type: "epi" })).toThrow();
  });

  it("trata note vazia/espaços como undefined", () => {
    expect(categoryInputSchema.parse({ ...base, note: "   " }).note).toBeUndefined();
  });
});
