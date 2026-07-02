import { isValidCa, normalizeCa } from "@/shared/integrations/caepi/normalize";

describe("normalizeCa", () => {
  it("remove máscara, espaços e separadores mantendo só dígitos", () => {
    expect(normalizeCa("CA 31.469")).toBe("31469");
    expect(normalizeCa(" 31469 ")).toBe("31469");
    expect(normalizeCa("31-469")).toBe("31469");
  });

  it("preserva zeros à esquerda (chave textual idêntica à da fonte)", () => {
    expect(normalizeCa("0123")).toBe("0123");
  });
});

describe("isValidCa", () => {
  it("aceita 1 a 10 dígitos, com ou sem máscara leve", () => {
    expect(isValidCa("5")).toBe(true);
    expect(isValidCa("31469")).toBe(true);
    expect(isValidCa(" 31.469 ")).toBe(true);
    expect(isValidCa("1234567890")).toBe(true);
  });

  it("rejeita vazio ou sem nenhum dígito", () => {
    expect(isValidCa("")).toBe(false);
    expect(isValidCa("   ")).toBe(false);
    expect(isValidCa("-.")).toBe(false);
  });

  it("rejeita valores com letras", () => {
    expect(isValidCa("abc")).toBe(false);
    expect(isValidCa("31469a")).toBe(false);
    expect(isValidCa("CA 31469")).toBe(false);
  });

  it("rejeita estouro de tamanho (mais de 10 dígitos)", () => {
    expect(isValidCa("12345678901")).toBe(false);
  });
});
