import {
  canSign,
  createDeliverySchema,
  signatureStatusLabel,
} from "@/shared/domains/pgr/epi-deliveries";

const VALID_INPUT = {
  employeeId: "11111111-1111-1111-1111-111111111111",
  deliveryDate: "2026-07-03",
  items: [{ stockId: "22222222-2222-2222-2222-222222222222", quantity: 2 }],
};

describe("createDeliverySchema", () => {
  it("aceita entrada válida e coage quantity de string do form", () => {
    const parsed = createDeliverySchema.parse({
      ...VALID_INPUT,
      items: [{ ...VALID_INPUT.items[0], quantity: "3" }],
    });
    expect(parsed.items[0].quantity).toBe(3);
  });

  it("rejeita lista de itens vazia (min 1)", () => {
    const result = createDeliverySchema.safeParse({ ...VALID_INPUT, items: [] });
    expect(result.success).toBe(false);
  });

  it.each([0, -1, 1.5])("rejeita quantity inválida (%p)", (quantity) => {
    const result = createDeliverySchema.safeParse({
      ...VALID_INPUT,
      items: [{ ...VALID_INPUT.items[0], quantity }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita employeeId/stockId não-uuid e data fora do formato ISO", () => {
    expect(
      createDeliverySchema.safeParse({ ...VALID_INPUT, employeeId: "abc" }).success,
    ).toBe(false);
    expect(
      createDeliverySchema.safeParse({
        ...VALID_INPUT,
        items: [{ stockId: "abc", quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      createDeliverySchema.safeParse({ ...VALID_INPUT, deliveryDate: "03/07/2026" })
        .success,
    ).toBe(false);
  });
});

describe("transição de assinatura (máquina de estados one-shot)", () => {
  it("só transiciona a partir de pending", () => {
    expect(canSign("pending")).toBe(true);
    expect(canSign("signed_manual")).toBe(false);
    expect(canSign("signed_qr")).toBe(false);
    expect(canSign("signed_link")).toBe(false);
  });

  it("rotula os 4 estados em pt-BR", () => {
    expect(signatureStatusLabel("pending")).toBe("Pendente de assinatura");
    expect(signatureStatusLabel("signed_manual")).toBe("Assinada (manual)");
    expect(signatureStatusLabel("signed_qr")).toBe("Assinada (QR Code)");
    expect(signatureStatusLabel("signed_link")).toBe("Assinada (link)");
  });
});
