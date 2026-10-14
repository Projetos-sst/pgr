import {
  leadInputSchema,
  parseInterestParam,
  LEAD_INTEREST_LABEL,
  LEAD_INTEREST_VALUES,
} from "@/shared/domains/platform/leads";

const valid = {
  name: "Ana Souza",
  company: "Consultoria SST Ltda",
  email: "Ana.Souza@Exemplo.com.br",
  phone: "(11) 98888-7777",
  interest: "both" as const,
  message: "Atendemos 12 empresas.",
  source: "quote" as const,
};

describe("leadInputSchema", () => {
  it("aceita um pedido completo e normaliza o e-mail para minúsculas", () => {
    const parsed = leadInputSchema.parse(valid);
    expect(parsed.email).toBe("ana.souza@exemplo.com.br");
    expect(parsed.name).toBe("Ana Souza");
    expect(parsed.source).toBe("quote");
  });

  it("assume a origem 'quote' quando ela não é informada", () => {
    const { source: _source, ...withoutSource } = valid;
    expect(leadInputSchema.parse(withoutSource).source).toBe("quote");
  });

  it("apara espaços em volta dos campos de texto", () => {
    const parsed = leadInputSchema.parse({
      ...valid,
      name: "  Ana  ",
      company: " ACME ",
    });
    expect(parsed.name).toBe("Ana");
    expect(parsed.company).toBe("ACME");
  });

  it("trata mensagem vazia como ausente, em vez de string vazia", () => {
    expect(leadInputSchema.parse({ ...valid, message: "   " }).message).toBeUndefined();
    const { message: _message, ...withoutMessage } = valid;
    expect(leadInputSchema.parse(withoutMessage).message).toBeUndefined();
  });

  it("recusa e-mail inválido", () => {
    const result = leadInputSchema.safeParse({ ...valid, email: "ana@" });
    expect(result.success).toBe(false);
  });

  it("recusa telefone sem DDD e aceita máscaras diferentes", () => {
    expect(leadInputSchema.safeParse({ ...valid, phone: "99999999" }).success).toBe(
      false,
    );
    for (const phone of ["11988887777", "(11) 98888-7777", "+55 11 98888 7777"]) {
      expect(leadInputSchema.safeParse({ ...valid, phone }).success).toBe(true);
    }
  });

  it("recusa área de interesse fora do conjunto", () => {
    expect(leadInputSchema.safeParse({ ...valid, interest: "financeiro" }).success).toBe(
      false,
    );
  });

  it("recusa campos obrigatórios vazios", () => {
    for (const field of ["name", "company", "email", "phone"] as const) {
      const result = leadInputSchema.safeParse({ ...valid, [field]: "" });
      expect(result.success).toBe(false);
    }
  });

  it("recusa mensagem acima do limite", () => {
    const result = leadInputSchema.safeParse({ ...valid, message: "x".repeat(1201) });
    expect(result.success).toBe(false);
  });

  it("não aceita campos extras como CPF — o schema é o contrato do que se coleta", () => {
    const parsed = leadInputSchema.parse({ ...valid, cpf: "12345678900" });
    expect(parsed).not.toHaveProperty("cpf");
  });
});

describe("parseInterestParam", () => {
  it("mapeia os rótulos em português usados nos links das vertentes", () => {
    expect(parseInterestParam("seguranca")).toBe("safety");
    expect(parseInterestParam("medicina")).toBe("health");
    expect(parseInterestParam("ambos")).toBe("both");
  });

  it("aceita também os valores do enum e ignora caixa", () => {
    expect(parseInterestParam("SAFETY")).toBe("safety");
    expect(parseInterestParam("Health")).toBe("health");
  });

  it("devolve null para valor desconhecido ou ausente", () => {
    expect(parseInterestParam("qualquer")).toBeNull();
    expect(parseInterestParam(undefined)).toBeNull();
    expect(parseInterestParam(["a", "b"])).toBeNull();
  });
});

describe("rótulos de interesse", () => {
  it("tem rótulo para cada valor do enum", () => {
    for (const value of LEAD_INTEREST_VALUES) {
      expect(LEAD_INTEREST_LABEL[value]).toBeTruthy();
    }
  });
});
