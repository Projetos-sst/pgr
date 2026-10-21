import {
  categoryTypeSchema,
  employeeSexSchema,
  maritalStatusSchema,
  employeeStatusSchema,
  riskGradeSchema,
  workerCountSchema,
  cpfSchema,
  cnpjSchema,
  isValidCnpjChecksum,
} from "@/shared/domains/pgr/validation";

describe("pgr domain validation (FR-024)", () => {
  describe("enum schemas", () => {
    it("accepts valid members and rejects unknown values", () => {
      expect(categoryTypeSchema.parse("epi")).toBe("epi");
      expect(categoryTypeSchema.parse("machine")).toBe("machine");
      expect(() => categoryTypeSchema.parse("vehicle")).toThrow();

      expect(employeeSexSchema.parse("not_informed")).toBe("not_informed");
      expect(() => employeeSexSchema.parse("other")).toThrow();

      expect(maritalStatusSchema.parse("stable_union")).toBe("stable_union");
      expect(() => maritalStatusSchema.parse("engaged")).toThrow();

      expect(employeeStatusSchema.parse("on_leave")).toBe("on_leave");
      expect(() => employeeStatusSchema.parse("retired")).toThrow();
    });
  });

  describe("riskGradeSchema (NR-04, 1..4)", () => {
    it.each([1, 2, 3, 4])("accepts %i", (grade) => {
      expect(riskGradeSchema.parse(grade)).toBe(grade);
    });

    it.each([0, 5, -1, 1.5])("rejects %p", (grade) => {
      expect(() => riskGradeSchema.parse(grade)).toThrow();
    });
  });

  describe("workerCountSchema (> 0)", () => {
    it("accepts positive integers", () => {
      expect(workerCountSchema.parse(1)).toBe(1);
      expect(workerCountSchema.parse(42)).toBe(42);
    });

    it.each([0, -3, 2.5])("rejects %p", (count) => {
      expect(() => workerCountSchema.parse(count)).toThrow();
    });
  });

  describe("cpf/cnpj format (não unicidade)", () => {
    it("accepts well-formed cpf (with or without mask) and normalizes to digits", () => {
      expect(cpfSchema.parse("12345678901")).toBe("12345678901");
      expect(cpfSchema.parse("123.456.789-01")).toBe("12345678901");
    });

    it("rejects cpf with wrong digit count", () => {
      expect(() => cpfSchema.parse("123")).toThrow();
      expect(() => cpfSchema.parse("123456789012")).toThrow();
    });

    it("accepts well-formed cnpj and normalizes to digits", () => {
      expect(cnpjSchema.parse("11222333000181")).toBe("11222333000181");
      expect(cnpjSchema.parse("11.222.333/0001-81")).toBe("11222333000181");
    });

    it("rejects cnpj with wrong digit count", () => {
      expect(() => cnpjSchema.parse("11222333")).toThrow();
    });
  });

  describe("isValidCnpjChecksum", () => {
    it("accepts a valid CNPJ with correct check digits", () => {
      // 11.222.333/0001-81 is a known valid CNPJ used for testing
      expect(isValidCnpjChecksum("11222333000181")).toBe(true);
    });

    it("rejects a CNPJ with incorrect check digits", () => {
      // Same base but with wrong check digits
      expect(isValidCnpjChecksum("11222333000182")).toBe(false);
      expect(isValidCnpjChecksum("11222333000100")).toBe(false);
    });

    it("rejects a CNPJ with all same digits", () => {
      expect(isValidCnpjChecksum("11111111111111")).toBe(false);
      expect(isValidCnpjChecksum("00000000000000")).toBe(false);
      expect(isValidCnpjChecksum("99999999999999")).toBe(false);
    });

    it("rejects a CNPJ with less than 14 digits", () => {
      expect(isValidCnpjChecksum("112223330001")).toBe(false);
      expect(isValidCnpjChecksum("1122233300018")).toBe(false);
    });

    it("rejects a CNPJ with more than 14 digits", () => {
      expect(isValidCnpjChecksum("112223330001810")).toBe(false);
    });
  });

  describe("cnpjSchema with check digit validation", () => {
    it("accepts a valid CNPJ and validates check digits", () => {
      expect(cnpjSchema.parse("11.222.333/0001-81")).toBe("11222333000181");
      expect(cnpjSchema.parse("11222333000181")).toBe("11222333000181");
    });

    it("rejects a CNPJ with invalid check digits", () => {
      expect(() => cnpjSchema.parse("11222333000182")).toThrow(
        /dígito verificador incorreto/,
      );
    });

    it("rejects a CNPJ with all same digits", () => {
      expect(() => cnpjSchema.parse("11111111111111")).toThrow(
        /dígito verificador incorreto/,
      );
    });

    it("rejects CNPJ with wrong digit count before check digit validation", () => {
      expect(() => cnpjSchema.parse("11222333")).toThrow(/deve ter 14 caracteres/);
    });
  });
});
