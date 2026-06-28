import {
  deliveryCreateSchema,
  signMethodSchema,
  generateAuthToken,
  isTokenExpired,
  nextSignatureStatus,
  signedQuantityForDelivery,
  signatureStatusLabel,
  canSendLink,
  TOKEN_EXPIRY_HOURS,
} from "@/shared/domains/pgr/epi-deliveries";

const EMPLOYEE = "11111111-1111-1111-1111-1111111111a4";
const STOCK_1 = "11111111-1111-1111-1111-1111111111a8";
const STOCK_2 = "22222222-2222-2222-2222-2222222222b8";
const DATE = "2026-06-26";

describe("deliveryCreateSchema", () => {
  it("aceita entrega válida e faz coerce de quantity", () => {
    const parsed = deliveryCreateSchema.parse({
      employeeId: EMPLOYEE,
      deliveryDate: DATE,
      items: [{ stockId: STOCK_1, quantity: "2" }],
    });
    expect(parsed.items).toEqual([{ stockId: STOCK_1, quantity: 2 }]);
    expect(parsed.employeeId).toBe(EMPLOYEE);
  });

  it("rejeita lista de itens vazia", () => {
    expect(() =>
      deliveryCreateSchema.parse({ employeeId: EMPLOYEE, deliveryDate: DATE, items: [] }),
    ).toThrow();
  });

  it("rejeita stockId duplicado na entrega", () => {
    expect(() =>
      deliveryCreateSchema.parse({
        employeeId: EMPLOYEE,
        deliveryDate: DATE,
        items: [
          { stockId: STOCK_1, quantity: "1" },
          { stockId: STOCK_1, quantity: "2" },
        ],
      }),
    ).toThrow();
  });

  it("aceita itens distintos", () => {
    const parsed = deliveryCreateSchema.parse({
      employeeId: EMPLOYEE,
      deliveryDate: DATE,
      items: [
        { stockId: STOCK_1, quantity: "1" },
        { stockId: STOCK_2, quantity: "2" },
      ],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it.each(["0", "-1", "2.5"])("rejeita quantity inválida %p", (quantity) => {
    expect(() =>
      deliveryCreateSchema.parse({
        employeeId: EMPLOYEE,
        deliveryDate: DATE,
        items: [{ stockId: STOCK_1, quantity }],
      }),
    ).toThrow();
  });

  it("rejeita employeeId !uuid e data fora do ISO", () => {
    expect(() =>
      deliveryCreateSchema.parse({
        employeeId: "x",
        deliveryDate: DATE,
        items: [{ stockId: STOCK_1, quantity: "1" }],
      }),
    ).toThrow();
    expect(() =>
      deliveryCreateSchema.parse({
        employeeId: EMPLOYEE,
        deliveryDate: "26/06/2026",
        items: [{ stockId: STOCK_1, quantity: "1" }],
      }),
    ).toThrow();
  });
});

describe("signMethodSchema (rota pública)", () => {
  it.each(["qr", "link"])("aceita %s", (m) => {
    expect(signMethodSchema.parse(m)).toBe(m);
  });
  it.each(["manual", "", "foo"])("rejeita %p", (m) => {
    expect(() => signMethodSchema.parse(m)).toThrow();
  });
});

describe("isTokenExpired (janela de 72h derivada de created_at)", () => {
  const created = new Date("2026-06-01T00:00:00.000Z");
  const hours = (h: number) => new Date(created.getTime() + h * 60 * 60 * 1000);

  it("dentro da janela → não expirado", () => {
    expect(isTokenExpired(created, hours(1))).toBe(false);
    expect(isTokenExpired(created, hours(71))).toBe(false);
  });

  it("no instante exato do limite (72h) → ainda válido", () => {
    expect(isTokenExpired(created, hours(TOKEN_EXPIRY_HOURS))).toBe(false);
  });

  it("após a janela → expirado", () => {
    expect(isTokenExpired(created, new Date(hours(TOKEN_EXPIRY_HOURS).getTime() + 1))).toBe(
      true,
    );
    expect(isTokenExpired(created, hours(100))).toBe(true);
  });

  it("respeita janela customizada", () => {
    expect(isTokenExpired(created, hours(2), 1)).toBe(true);
    expect(isTokenExpired(created, hours(2), 24)).toBe(false);
  });
});

describe("nextSignatureStatus", () => {
  it("qr → signed_qr; link → signed_link", () => {
    expect(nextSignatureStatus("qr")).toBe("signed_qr");
    expect(nextSignatureStatus("link")).toBe("signed_link");
  });
});

describe("signedQuantityForDelivery (entrega sempre subtrai)", () => {
  it("retorna a quantidade negativa", () => {
    expect(signedQuantityForDelivery(5)).toBe(-5);
    expect(signedQuantityForDelivery(1)).toBe(-1);
  });
});

describe("signatureStatusLabel (pt-BR)", () => {
  it.each([
    ["pending", "Aguardando assinatura"],
    ["signed_qr", "Assinada (QR Code)"],
    ["signed_link", "Assinada (link)"],
    ["signed_manual", "Assinada (manual)"],
  ] as const)("%s → %s", (status, label) => {
    expect(signatureStatusLabel(status)).toBe(label);
  });
});

describe("canSendLink (disponibilidade do 'Enviar Link' — FR-018)", () => {
  it("true com e-mail OU telefone", () => {
    expect(canSendLink({ email: "a@b.com", phone: null })).toBe(true);
    expect(canSendLink({ email: null, phone: "11999998888" })).toBe(true);
  });
  it("false sem nenhum contato (ou só espaços)", () => {
    expect(canSendLink({ email: null, phone: null })).toBe(false);
    expect(canSendLink({ email: "  ", phone: "" })).toBe(false);
  });
});

describe("generateAuthToken (token de capacidade)", () => {
  it("gera 64 hex chars (256 bits) e é único entre chamadas", () => {
    const a = generateAuthToken();
    const b = generateAuthToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
