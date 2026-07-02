import {
  isValidCep,
  isValidCnpj,
  normalizeCep,
  normalizeCnpj,
  onlyDigits,
} from "@/shared/integrations/validation";

describe("normalização", () => {
  it("remove máscara e mantém só dígitos", () => {
    expect(onlyDigits("01001-000")).toBe("01001000");
    expect(normalizeCep(" 01001-000 ")).toBe("01001000");
    expect(normalizeCnpj("11.444.777/0001-61")).toBe("11444777000161");
  });
});

describe("isValidCep", () => {
  it("aceita 8 dígitos, com ou sem máscara", () => {
    expect(isValidCep("01001000")).toBe(true);
    expect(isValidCep("01001-000")).toBe(true);
  });

  it("rejeita comprimento diferente de 8", () => {
    expect(isValidCep("1234")).toBe(false);
    expect(isValidCep("010010001")).toBe(false);
    expect(isValidCep("")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJ com dígitos verificadores corretos", () => {
    expect(isValidCnpj("11444777000161")).toBe(true);
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(isValidCnpj("11444777000162")).toBe(false);
  });

  it("rejeita sequência repetida (passa no cálculo, mas não é CNPJ)", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("rejeita comprimento diferente de 14", () => {
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpj("114447770001611")).toBe(false);
  });
});
