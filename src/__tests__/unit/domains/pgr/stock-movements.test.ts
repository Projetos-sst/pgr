import {
  stockEntrySchema,
  stockExitSchema,
  signedQuantity,
  stockMovementTypeLabel,
  computeRunningBalance,
} from "@/shared/domains/pgr/stock-movements";

const UUID = "11111111-1111-1111-1111-1111111111a8";
const DATE = "2026-06-26";

describe("stockEntrySchema", () => {
  it("aceita campos válidos e faz coerce/trim", () => {
    const parsed = stockEntrySchema.parse({
      stockId: UUID,
      quantity: "5",
      movementDate: DATE,
      invoiceNumber: "  NF-123  ",
    });
    expect(parsed).toEqual({
      stockId: UUID,
      quantity: 5,
      movementDate: DATE,
      invoiceNumber: "NF-123",
    });
  });

  it("NF vazia vira undefined (opcional)", () => {
    const parsed = stockEntrySchema.parse({
      stockId: UUID,
      quantity: "1",
      movementDate: DATE,
      invoiceNumber: "",
    });
    expect(parsed.invoiceNumber).toBeUndefined();
  });

  it("aceita lote opcional (issue #23); vazio vira undefined", () => {
    const withBatch = stockEntrySchema.parse({
      stockId: UUID,
      quantity: "1",
      movementDate: DATE,
      batch: "  LOTE-42  ",
    });
    expect(withBatch.batch).toBe("LOTE-42");

    const withoutBatch = stockEntrySchema.parse({
      stockId: UUID,
      quantity: "1",
      movementDate: DATE,
      batch: "",
    });
    expect(withoutBatch.batch).toBeUndefined();
  });

  it.each(["0", "-1", "2.5"])("rejeita quantidade inválida %p", (qty) => {
    expect(() =>
      stockEntrySchema.parse({ stockId: UUID, quantity: qty, movementDate: DATE }),
    ).toThrow();
  });

  it("rejeita stockId ausente/!uuid", () => {
    expect(() =>
      stockEntrySchema.parse({ stockId: "x", quantity: "1", movementDate: DATE }),
    ).toThrow();
  });

  it.each(["2026/06/26", "26-06-2026", "ontem"])(
    "rejeita data fora do formato ISO %p",
    (date) => {
      expect(() =>
        stockEntrySchema.parse({ stockId: UUID, quantity: "1", movementDate: date }),
      ).toThrow();
    },
  );
});

describe("stockExitSchema", () => {
  it.each(["adjustment", "discard"])("aceita tipo de saída %s", (type) => {
    const parsed = stockExitSchema.parse({
      stockId: UUID,
      quantity: "3",
      movementDate: DATE,
      type,
    });
    expect(parsed.type).toBe(type);
    expect(parsed.quantity).toBe(3);
  });

  it.each(["purchase", "employee_delivery", "foo"])(
    "rejeita tipo fora de {adjustment,discard}: %p",
    (type) => {
      expect(() =>
        stockExitSchema.parse({ stockId: UUID, quantity: "3", movementDate: DATE, type }),
      ).toThrow();
    },
  );

  it("rejeita quantidade <= 0", () => {
    expect(() =>
      stockExitSchema.parse({
        stockId: UUID,
        quantity: "0",
        movementDate: DATE,
        type: "adjustment",
      }),
    ).toThrow();
  });
});

describe("signedQuantity (sinal vem do tipo, quantity sempre > 0)", () => {
  it("purchase soma; demais subtraem", () => {
    expect(signedQuantity("purchase", 10)).toBe(10);
    expect(signedQuantity("adjustment", 3)).toBe(-3);
    expect(signedQuantity("discard", 2)).toBe(-2);
    expect(signedQuantity("employee_delivery", 4)).toBe(-4);
  });
});

describe("stockMovementTypeLabel (rótulos pt-BR)", () => {
  it.each([
    ["purchase", "Entrada (compra)"],
    ["employee_delivery", "Entrega a funcionário"],
    ["adjustment", "Ajuste"],
    ["discard", "Descarte"],
  ] as const)("%s → %s", (type, label) => {
    expect(stockMovementTypeLabel(type)).toBe(label);
  });
});

describe("computeRunningBalance (saldo acumulado por linha, ordem cronológica asc)", () => {
  it("acumula um mix de entradas e saídas", () => {
    const running = computeRunningBalance([
      { type: "purchase", quantity: 10 },
      { type: "purchase", quantity: 5 },
      { type: "adjustment", quantity: 3 },
      { type: "discard", quantity: 2 },
    ]);
    expect(running).toEqual([10, 15, 12, 10]);
  });

  it("lista vazia → []", () => {
    expect(computeRunningBalance([])).toEqual([]);
  });

  it("último acumulado == saldo final esperado", () => {
    const running = computeRunningBalance([
      { type: "purchase", quantity: 8 },
      { type: "discard", quantity: 8 },
    ]);
    expect(running.at(-1)).toBe(0);
  });
});
