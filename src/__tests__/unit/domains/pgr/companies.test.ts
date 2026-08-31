import {
  companyInputSchema,
  companyStatusSchema,
  maskCnpjInput,
} from "@/shared/domains/pgr/companies";

describe("companyInputSchema (US1)", () => {
  const base = { razaoSocial: "Acme Ltda", riskGrade: "2" };

  it("aceita entrada mínima válida e coage riskGrade para número", () => {
    const parsed = companyInputSchema.parse(base);
    expect(parsed.razaoSocial).toBe("Acme Ltda");
    expect(parsed.riskGrade).toBe(2);
  });

  it("exige razão social não-vazia", () => {
    expect(() => companyInputSchema.parse({ ...base, razaoSocial: "  " })).toThrow();
  });

  it.each(["0", "5", "9"])("rejeita riskGrade fora de 1..4 (%s)", (riskGrade) => {
    expect(() => companyInputSchema.parse({ ...base, riskGrade })).toThrow();
  });

  it("aceita CNPJ vazio (opcional) → undefined", () => {
    expect(companyInputSchema.parse({ ...base, cnpj: "" }).cnpj).toBeUndefined();
  });

  it("normaliza CNPJ válido e rejeita formato inválido", () => {
    expect(companyInputSchema.parse({ ...base, cnpj: "11.222.333/0001-81" }).cnpj).toBe(
      "11222333000181",
    );
    expect(() => companyInputSchema.parse({ ...base, cnpj: "123" })).toThrow();
  });

  it("converte strings de endereço vazias em undefined", () => {
    const parsed = companyInputSchema.parse({ ...base, city: "", state: "SP" });
    expect(parsed.city).toBeUndefined();
    expect(parsed.state).toBe("SP");
  });

  it("aceita website vazio (opcional) → undefined", () => {
    expect(companyInputSchema.parse({ ...base, website: "" }).website).toBeUndefined();
  });

  it("aceita URL válida em website", () => {
    expect(
      companyInputSchema.parse({ ...base, website: "https://www.acme.com.br" }).website,
    ).toBe("https://www.acme.com.br");
  });

  it("rejeita website com formato inválido", () => {
    expect(() =>
      companyInputSchema.parse({ ...base, website: "não é uma url" }),
    ).toThrow();
  });
});

describe("companyStatusSchema / status no input", () => {
  const base = { razaoSocial: "Acme Ltda", riskGrade: "2" };

  it("status ausente assume 'active' (default)", () => {
    expect(companyInputSchema.parse(base).status).toBe("active");
  });

  it("aceita os três status válidos", () => {
    for (const s of ["active", "pending", "inactive"] as const) {
      expect(companyStatusSchema.parse(s)).toBe(s);
      expect(companyInputSchema.parse({ ...base, status: s }).status).toBe(s);
    }
  });

  it("rejeita status inválido", () => {
    expect(() => companyStatusSchema.parse("archived")).toThrow();
  });

  it("aceita classificação tributária (texto livre opcional)", () => {
    expect(
      companyInputSchema.parse({ ...base, taxClassification: "01" }).taxClassification,
    ).toBe("01");
    expect(
      companyInputSchema.parse({ ...base, taxClassification: "" }).taxClassification,
    ).toBeUndefined();
  });
});

describe("maskCnpjInput", () => {
  it("returns empty string for empty input", () => {
    expect(maskCnpjInput("")).toBe("");
  });

  it("applies progressive mask for partial digits", () => {
    expect(maskCnpjInput("1")).toBe("1");
    expect(maskCnpjInput("11")).toBe("11");
    expect(maskCnpjInput("112")).toBe("11.2");
    expect(maskCnpjInput("1122")).toBe("11.22");
    expect(maskCnpjInput("11222")).toBe("11.222");
    expect(maskCnpjInput("112223")).toBe("11.222.3");
    expect(maskCnpjInput("1122233")).toBe("11.222.33");
    expect(maskCnpjInput("11222333")).toBe("11.222.333");
    expect(maskCnpjInput("112223330")).toBe("11.222.333/0");
    expect(maskCnpjInput("1122233300")).toBe("11.222.333/00");
    expect(maskCnpjInput("11222333000")).toBe("11.222.333/000");
    expect(maskCnpjInput("112223330001")).toBe("11.222.333/0001");
    expect(maskCnpjInput("1122233300018")).toBe("11.222.333/0001-8");
    expect(maskCnpjInput("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("removes non-digit characters before applying mask", () => {
    expect(maskCnpjInput("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(maskCnpjInput("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCnpjInput("11-222-333-0001-81")).toBe("11.222.333/0001-81");
  });

  it("is idempotent — applying mask to already masked input returns same output", () => {
    const masked = "11.222.333/0001-81";
    expect(maskCnpjInput(masked)).toBe(masked);
    // applying again
    expect(maskCnpjInput(maskCnpjInput(masked))).toBe(masked);
  });

  it("ignores letters and special characters mixed with digits", () => {
    expect(maskCnpjInput("11a2b2c2d333000e1f81")).toBe("11.222.333/0001-81");
    expect(maskCnpjInput("11@222#333$0001%81")).toBe("11.222.333/0001-81");
  });

  it("truncates to 14 digits maximum", () => {
    expect(maskCnpjInput("112223330001819999")).toBe("11.222.333/0001-81");
    expect(maskCnpjInput("1122233300018123456")).toBe("11.222.333/0001-81");
  });
});
