import {
  INTEREST_MESSAGE_MAX_LENGTH,
  interestFiltersSchema,
  interestIdSchema,
  interestInputSchema,
  interestServiceSchema,
  interestStatusSchema,
  isInterestOpen,
} from "@/shared/domains/commercial/interest";

const COMPANY = "11111111-1111-4111-8111-111111111111";

describe("interestInputSchema", () => {
  it.each(["pgr", "medicine", "pro", "one_off"])("aceita o serviço %s", (service) => {
    expect(interestInputSchema.safeParse({ companyId: COMPANY, service }).success).toBe(
      true,
    );
    expect(interestServiceSchema.safeParse(service).success).toBe(true);
  });

  it("recusa serviço desconhecido e empresa inválida", () => {
    expect(
      interestInputSchema.safeParse({ companyId: COMPANY, service: "outro" }).success,
    ).toBe(false);
    expect(
      interestInputSchema.safeParse({ companyId: "abc", service: "pgr" }).success,
    ).toBe(false);
  });

  it("aceita a mensagem no limite e recusa acima dele", () => {
    const atLimit = "a".repeat(INTEREST_MESSAGE_MAX_LENGTH);
    const parsed = interestInputSchema.parse({
      companyId: COMPANY,
      service: "pgr",
      message: atLimit,
    });
    expect(parsed.message).toBe(atLimit);
    expect(
      interestInputSchema.safeParse({
        companyId: COMPANY,
        service: "pgr",
        message: `${atLimit}a`,
      }).success,
    ).toBe(false);
  });

  it("apara a mensagem e trata vazia como ausente", () => {
    expect(
      interestInputSchema.parse({ companyId: COMPANY, service: "pgr", message: "  oi  " })
        .message,
    ).toBe("oi");
    expect(
      interestInputSchema.parse({ companyId: COMPANY, service: "pgr", message: "   " })
        .message,
    ).toBeUndefined();
  });

  it.each(["channel", "whatsapp", "email", "sms"])(
    "rejeita o campo extra %s",
    (field) => {
      expect(
        interestInputSchema.safeParse({
          companyId: COMPANY,
          service: "pgr",
          [field]: "x",
        }).success,
      ).toBe(false);
    },
  );
});

describe("filtros e situação", () => {
  it("aceita open e seen e recusa outros valores", () => {
    expect(interestStatusSchema.safeParse("open").success).toBe(true);
    expect(interestStatusSchema.safeParse("seen").success).toBe(true);
    expect(interestFiltersSchema.safeParse({ status: "aberto" }).success).toBe(false);
  });

  it("valida a empresa do filtro e a paginação", () => {
    expect(
      interestFiltersSchema.safeParse({ companyId: COMPANY, status: "open", page: 1 })
        .success,
    ).toBe(true);
    expect(interestFiltersSchema.safeParse({ companyId: "x" }).success).toBe(false);
    expect(interestFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("valida o identificador do interesse", () => {
    expect(interestIdSchema.safeParse(COMPANY).success).toBe(true);
    expect(interestIdSchema.safeParse("nope").success).toBe(false);
  });

  it("considera aberto o interesse sem data de visualização", () => {
    expect(isInterestOpen({ seenAt: null })).toBe(true);
    expect(isInterestOpen({ seenAt: new Date() })).toBe(false);
  });
});
