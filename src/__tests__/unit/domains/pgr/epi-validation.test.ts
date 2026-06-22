import {
  stockMovementTypeSchema,
  epiSignatureStatusSchema,
  epiQuantitySchema,
} from "@/shared/domains/pgr/validation";

describe("epi domain validation (modelo de dados de EPIs)", () => {
  describe("stockMovementTypeSchema", () => {
    it.each(["purchase", "employee_delivery", "adjustment", "discard"])(
      "aceita o membro %s",
      (type) => {
        expect(stockMovementTypeSchema.parse(type)).toBe(type);
      },
    );

    it("rejeita valor fora do conjunto", () => {
      expect(() => stockMovementTypeSchema.parse("loan")).toThrow();
      expect(() => stockMovementTypeSchema.parse("")).toThrow();
    });
  });

  describe("epiSignatureStatusSchema", () => {
    it.each(["pending", "signed_qr", "signed_link", "signed_manual"])(
      "aceita o membro %s",
      (status) => {
        expect(epiSignatureStatusSchema.parse(status)).toBe(status);
      },
    );

    it("rejeita valor fora do conjunto", () => {
      expect(() => epiSignatureStatusSchema.parse("signed_voice")).toThrow();
    });
  });

  describe("epiQuantitySchema (> 0, espelha o CHECK do banco)", () => {
    it("aceita inteiros positivos", () => {
      expect(epiQuantitySchema.parse(1)).toBe(1);
      expect(epiQuantitySchema.parse(99)).toBe(99);
    });

    it.each([0, -1, 2.5])("rejeita %p", (qty) => {
      expect(() => epiQuantitySchema.parse(qty)).toThrow();
    });
  });
});
