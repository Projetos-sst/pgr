import { validateCa, todayInSaoPaulo } from "@/shared/integrations/caepi/validate-ca";

const TODAY = "2026-07-02";

describe("validateCa", () => {
  it("situação VÁLIDO com validade futura → valid", () => {
    expect(validateCa({ situation: "VÁLIDO", validUntil: "2027-01-15" }, TODAY)).toBe(
      "valid",
    );
  });

  it("limite: valid_until == hoje → valid (inclusivo, não vencido)", () => {
    expect(validateCa({ situation: "VÁLIDO", validUntil: TODAY }, TODAY)).toBe("valid");
  });

  it("situação VÁLIDO com validade passada → expired", () => {
    expect(validateCa({ situation: "VÁLIDO", validUntil: "2026-07-01" }, TODAY)).toBe(
      "expired",
    );
  });

  it("situação VENCIDO → expired mesmo com data futura", () => {
    expect(validateCa({ situation: "VENCIDO", validUntil: "2027-01-15" }, TODAY)).toBe(
      "expired",
    );
  });

  it("situação CANCELADO → expired", () => {
    expect(validateCa({ situation: "CANCELADO", validUntil: "2027-01-15" }, TODAY)).toBe(
      "expired",
    );
  });

  it("situação desconhecida → expired (conservador, nunca selo verde indevido)", () => {
    expect(validateCa({ situation: "EM ANÁLISE", validUntil: "2027-01-15" }, TODAY)).toBe(
      "expired",
    );
  });

  it("normaliza acento e caixa da situação (válido/VALIDO/ Válido )", () => {
    expect(validateCa({ situation: "válido", validUntil: "2027-01-15" }, TODAY)).toBe(
      "valid",
    );
    expect(validateCa({ situation: "VALIDO", validUntil: "2027-01-15" }, TODAY)).toBe(
      "valid",
    );
    expect(validateCa({ situation: " Válido ", validUntil: "2027-01-15" }, TODAY)).toBe(
      "valid",
    );
  });
});

describe("todayInSaoPaulo", () => {
  it("devolve YYYY-MM-DD", () => {
    expect(todayInSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
