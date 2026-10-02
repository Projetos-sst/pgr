import { pgrDocxRequestSchema } from "@/shared/domains/pgr/pgr-docx/request";

describe("pgrDocxRequestSchema", () => {
  it("formato padrão é docx e overrides são opcionais", () => {
    expect(pgrDocxRequestSchema.parse({})).toEqual({ format: "docx" });
    expect(pgrDocxRequestSchema.parse({ format: "pdf" })).toEqual({ format: "pdf" });
  });

  it("aceita semi-fixos conhecidos", () => {
    const parsed = pgrDocxRequestSchema.parse({
      overrides: {
        labels: { company: " Contratada: " },
        titles: { introduction: "1 - APRESENTAÇÃO" },
        texts: { objective: "Texto livre" },
        campaigns: [{ month: "Março", theme: "Março Lilás", actions: "Palestra" }],
      },
    });
    expect(parsed.overrides?.labels?.company).toBe("Contratada:");
    expect(parsed.overrides?.campaigns).toHaveLength(1);
  });

  it("recusa chave desconhecida, formato inválido e título vazio", () => {
    expect(pgrDocxRequestSchema.safeParse({ format: "odt" }).success).toBe(false);
    expect(
      pgrDocxRequestSchema.safeParse({ overrides: { labels: { inexistente: "x" } } })
        .success,
    ).toBe(false);
    expect(pgrDocxRequestSchema.safeParse({ overrides: { extra: {} } }).success).toBe(
      false,
    );
    expect(
      pgrDocxRequestSchema.safeParse({ overrides: { titles: { introduction: "  " } } })
        .success,
    ).toBe(false);
    expect(pgrDocxRequestSchema.safeParse(null).success).toBe(false);
  });
});
