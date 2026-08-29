import {
  deriveStockStatus,
  epiStockCreateSchema,
  epiStockUpdateSchema,
} from "@/shared/domains/pgr/epi-stock";

const UUID = "11111111-1111-1111-1111-1111111111a7";

describe("deriveStockStatus (status derivado do estoque)", () => {
  it.each([
    [0, 0, "sem_saldo"],
    [0, 5, "sem_saldo"],
    [3, 5, "abaixo_minima"],
    [4, 5, "abaixo_minima"],
    [5, 5, "acima_minima"],
    [10, 2, "acima_minima"],
    [5, 0, "acima_minima"], // mínima 0 nunca gera alerta
  ])("balance=%i, min=%i → %s", (balance, min, expected) => {
    expect(deriveStockStatus(balance, min)).toBe(expected);
  });
});

describe("epiStockCreateSchema", () => {
  it("aceita catalogId + mínima (coerce de string)", () => {
    const parsed = epiStockCreateSchema.parse({ catalogId: UUID, minimumQuantity: "5" });
    expect(parsed).toEqual({ catalogId: UUID, minimumQuantity: 5 });
  });

  it("aceita mínima zero", () => {
    expect(
      epiStockCreateSchema.parse({ catalogId: UUID, minimumQuantity: "0" })
        .minimumQuantity,
    ).toBe(0);
  });

  it.each([-1, 2.5])("rejeita mínima inválida %p", (qty) => {
    expect(() =>
      epiStockCreateSchema.parse({ catalogId: UUID, minimumQuantity: qty }),
    ).toThrow();
  });

  it("rejeita catalogId ausente/!uuid", () => {
    expect(() =>
      epiStockCreateSchema.parse({ catalogId: "", minimumQuantity: 1 }),
    ).toThrow();
    expect(() =>
      epiStockCreateSchema.parse({ catalogId: "x", minimumQuantity: 1 }),
    ).toThrow();
  });

  describe("initialQuantity (saldo inicial opcional, #22)", () => {
    it("aceita ausente (undefined)", () => {
      const parsed = epiStockCreateSchema.parse({ catalogId: UUID, minimumQuantity: 0 });
      expect(parsed.initialQuantity).toBeUndefined();
    });

    it("aceita zero", () => {
      const parsed = epiStockCreateSchema.parse({
        catalogId: UUID,
        minimumQuantity: 0,
        initialQuantity: "0",
      });
      expect(parsed.initialQuantity).toBe(0);
    });

    it("aceita positivo (coerce de string)", () => {
      const parsed = epiStockCreateSchema.parse({
        catalogId: UUID,
        minimumQuantity: 0,
        initialQuantity: "10",
      });
      expect(parsed.initialQuantity).toBe(10);
    });

    it.each([-1, 2.5])("rejeita quantidade inicial inválida %p", (qty) => {
      expect(() =>
        epiStockCreateSchema.parse({
          catalogId: UUID,
          minimumQuantity: 0,
          initialQuantity: qty,
        }),
      ).toThrow();
    });
  });
});

describe("epiStockUpdateSchema", () => {
  it("aceita só a mínima", () => {
    expect(epiStockUpdateSchema.parse({ minimumQuantity: "3" })).toEqual({
      minimumQuantity: 3,
    });
  });
  it("rejeita mínima negativa", () => {
    expect(() => epiStockUpdateSchema.parse({ minimumQuantity: -2 })).toThrow();
  });
});
