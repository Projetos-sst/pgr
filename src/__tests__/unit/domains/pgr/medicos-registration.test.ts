/**
 * Conferência do número de registro profissional tolerante à formatação (NOB-110/NOB-163):
 * separadores ignorados, dígitos preservados (zeros à esquerda contam), letras não são adivinhadas
 * e a UF é comparada à parte, sem diferenciar maiúsculas. Dados fictícios.
 */
import {
  canonicalRegistrationNumber,
  compareProfessionalRegistration,
  registeredNotCanonicalMessage,
  signerRegistrationSchema,
} from "@/shared/domains/pgr/medicos";

describe("canonicalRegistrationNumber", () => {
  it("remove ponto, hífen, barra e espaços e mantém os dígitos", () => {
    expect(canonicalRegistrationNumber("12345")).toBe("12345");
    expect(canonicalRegistrationNumber("12.345")).toBe("12345");
    expect(canonicalRegistrationNumber(" 12 345 ")).toBe("12345");
    expect(canonicalRegistrationNumber("12-345")).toBe("12345");
    expect(canonicalRegistrationNumber("1/2.3-45")).toBe("12345");
  });
  it("preserva zeros à esquerda (sem conversão numérica)", () => {
    expect(canonicalRegistrationNumber("012345")).toBe("012345");
    expect(canonicalRegistrationNumber("0.012.345")).toBe("0012345");
  });
  it("letras ou outros caracteres tornam o valor não comparável", () => {
    expect(canonicalRegistrationNumber("12345-MA")).toBeNull();
    expect(canonicalRegistrationNumber("CRM 12.345/MA")).toBeNull();
    expect(canonicalRegistrationNumber("12345#")).toBeNull();
  });
  it("vazio, só separadores ou ausente: não comparável", () => {
    expect(canonicalRegistrationNumber("")).toBeNull();
    expect(canonicalRegistrationNumber(" .-/ ")).toBeNull();
    expect(canonicalRegistrationNumber(null)).toBeNull();
    expect(canonicalRegistrationNumber(undefined)).toBeNull();
  });
});

describe("compareProfessionalRegistration", () => {
  const registered = { crm: "12.345", uf: "MA" };
  it("mesmo número com outra formatação e UF em minúscula: confere", () => {
    expect(
      compareProfessionalRegistration(registered, { registration: "12345", uf: "ma" }),
    ).toBe("match");
    expect(
      compareProfessionalRegistration(
        { crm: "12345", uf: "MA" },
        { registration: "12.345", uf: " MA " },
      ),
    ).toBe("match");
  });
  it("número diferente, UF diferente ou zero à esquerda a mais: não confere", () => {
    expect(
      compareProfessionalRegistration(registered, { registration: "12346", uf: "MA" }),
    ).toBe("mismatch");
    expect(
      compareProfessionalRegistration(registered, { registration: "12345", uf: "PI" }),
    ).toBe("mismatch");
    expect(
      compareProfessionalRegistration(registered, { registration: "012345", uf: "MA" }),
    ).toBe("mismatch");
  });
  it("cadastro sem UF não confere; informado com letras não confere", () => {
    expect(
      compareProfessionalRegistration(
        { crm: "12345", uf: null },
        { registration: "12345", uf: "MA" },
      ),
    ).toBe("mismatch");
    expect(
      compareProfessionalRegistration(registered, {
        registration: "12345-MA",
        uf: "MA",
      }),
    ).toBe("mismatch");
  });
  it("cadastro com letras (ex.: sufixo de UF) não é adivinhado: pede correção do cadastro", () => {
    expect(
      compareProfessionalRegistration(
        { crm: "12345-MA", uf: "MA" },
        { registration: "12345", uf: "MA" },
      ),
    ).toBe("registered_not_canonical");
    expect(
      compareProfessionalRegistration(
        { crm: "CRM 12.345/MA", uf: "MA" },
        { registration: "12345", uf: "MA" },
      ),
    ).toBe("registered_not_canonical");
    expect(registeredNotCanonicalMessage("do médico examinador", "12345-MA")).toMatch(
      /corrigir o cadastro/,
    );
  });
});

describe("signerRegistrationSchema", () => {
  it("aceita dígitos com separadores e guarda o valor aparado, sem reescrever", () => {
    expect(signerRegistrationSchema.parse(" 12.345 ")).toBe("12.345");
    expect(signerRegistrationSchema.parse("12345")).toBe("12345");
  });
  it("recusa letras, vazio e mais de 10 dígitos", () => {
    expect(() => signerRegistrationSchema.parse("12345-MA")).toThrow(/só números/);
    expect(() => signerRegistrationSchema.parse("")).toThrow(/só números/);
    expect(() => signerRegistrationSchema.parse("12345678901")).toThrow(/só números/);
  });
});
