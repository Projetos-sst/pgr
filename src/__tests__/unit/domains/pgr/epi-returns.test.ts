import {
  returnCreateSchema,
  isReturnDateBeforeDelivery,
} from "@/shared/domains/pgr/epi-returns";
import {
  signedQuantity,
  stockMovementTypeLabel,
} from "@/shared/domains/pgr/stock-movements";

const DELIVERY = "11111111-1111-1111-1111-1111111111a9";
const ITEM_1 = "11111111-1111-1111-1111-1111111111c1";
const ITEM_2 = "11111111-1111-1111-1111-1111111111c2";
const DATE = "2026-06-26";

describe("returnCreateSchema", () => {
  it("aceita devolução válida", () => {
    const parsed = returnCreateSchema.parse({
      deliveryId: DELIVERY,
      returnDate: DATE,
      itemIds: [ITEM_1, ITEM_2],
    });
    expect(parsed.itemIds).toHaveLength(2);
    expect(parsed.deliveryId).toBe(DELIVERY);
  });

  it("rejeita itemIds vazio", () => {
    expect(() =>
      returnCreateSchema.parse({ deliveryId: DELIVERY, returnDate: DATE, itemIds: [] }),
    ).toThrow();
  });

  it("rejeita item repetido", () => {
    expect(() =>
      returnCreateSchema.parse({
        deliveryId: DELIVERY,
        returnDate: DATE,
        itemIds: [ITEM_1, ITEM_1],
      }),
    ).toThrow();
  });

  it("rejeita uuid inválido e data fora do ISO", () => {
    expect(() =>
      returnCreateSchema.parse({ deliveryId: "x", returnDate: DATE, itemIds: [ITEM_1] }),
    ).toThrow();
    expect(() =>
      returnCreateSchema.parse({
        deliveryId: DELIVERY,
        returnDate: "26/06/2026",
        itemIds: [ITEM_1],
      }),
    ).toThrow();
  });
});

describe("isReturnDateBeforeDelivery", () => {
  it("data de devolução anterior à entrega → true", () => {
    expect(isReturnDateBeforeDelivery("2026-06-25", "2026-06-26")).toBe(true);
  });
  it("igual ou posterior → false", () => {
    expect(isReturnDateBeforeDelivery("2026-06-26", "2026-06-26")).toBe(false);
    expect(isReturnDateBeforeDelivery("2026-06-27", "2026-06-26")).toBe(false);
  });
});

describe("employee_return no domínio de movimentos", () => {
  it("signedQuantity('employee_return') SOMA (entrada)", () => {
    expect(signedQuantity("employee_return", 5)).toBe(5);
  });
  it("entrega continua subtraindo (sem regressão)", () => {
    expect(signedQuantity("employee_delivery", 5)).toBe(-5);
    expect(signedQuantity("purchase", 5)).toBe(5);
  });
  it("rótulo pt-BR", () => {
    expect(stockMovementTypeLabel("employee_return")).toBe("Devolução de funcionário");
  });
});
