/**
 * Conferência do número de registro profissional tolerante à formatação (NOB-110/NOB-163):
 * separadores ignorados, dígitos preservados (zeros à esquerda contam), letras não são adivinhadas
 * e a UF é comparada à parte, sem diferenciar maiúsculas. Dados fictícios.
 */
import {
  canonicalRegistrationNumber,
  compareProfessionalRegistration,
  countRegistrationDuplicateGroups,
  findRegistrationDuplicate,
  registeredNotCanonicalMessage,
  registrationDuplicateMessage,
  registrationIdentityChanged,
  registrationLockKey,
  registrationScope,
  signerRegistrationSchema,
  MEDICO_REGISTRATION_DUPLICATE_MESSAGE,
  MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE,
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

/**
 * Prevenção de cadastro duplicado por formatação (NOB-110/NOB-112): mesmo escritório,
 * categoria, UF e número canônico. Dados fictícios.
 */
const physician = (crm: string, registrationUf: string | null = "MA") => ({
  crm,
  profession: "physician" as const,
  registrationUf,
});
const psychologist = (crm: string, registrationUf: string | null = "MA") => ({
  crm,
  profession: "psychologist" as const,
  registrationUf,
});

describe("registrationScope / registrationLockKey", () => {
  it("normaliza número e UF; formatos equivalentes geram a mesma chave", () => {
    const a = registrationScope(physician("12.345", "ma"));
    const b = registrationScope(physician("12345", "MA"));
    expect(a).toEqual({ profession: "physician", uf: "MA", number: "12345" });
    expect(registrationLockKey("org_a", a!)).toBe(registrationLockKey("org_a", b!));
  });
  it("UF, categoria, zero à esquerda e escritório diferentes: chaves diferentes", () => {
    const base = registrationScope(physician("12345"))!;
    const keys = new Set([
      registrationLockKey("org_a", base),
      registrationLockKey("org_b", base),
      registrationLockKey("org_a", { ...base, uf: "PI" }),
      registrationLockKey("org_a", { ...base, profession: "psychologist" }),
      registrationLockKey("org_a", { ...base, number: "012345" }),
    ]);
    expect(keys.size).toBe(5);
  });
  it("número não canônico ou UF ausente: fora da conferência", () => {
    expect(registrationScope(physician("CRM 12.345/MA"))).toBeNull();
    expect(registrationScope(physician("12345", null))).toBeNull();
  });
});

describe("findRegistrationDuplicate", () => {
  const scope = { profession: "physician" as const, uf: "MA", number: "12345" };
  it("mesmo número em outra formatação, mesma categoria e UF (sem maiúsculas)", () => {
    expect(findRegistrationDuplicate([physician("12.345", "ma")], scope)).toBe("same_uf");
  });
  it("outra UF, outra categoria, zero à esquerda ou não canônico: não é duplicata", () => {
    const others = [
      physician("12.345", "PI"),
      psychologist("12.345"),
      physician("012345"),
      physician("12345-MA"),
    ];
    expect(findRegistrationDuplicate(others, scope)).toBeNull();
  });
  it("cadastro antigo sem UF, mesmo número e categoria: possível duplicata", () => {
    expect(findRegistrationDuplicate([physician("12-345", null)], scope)).toBe(
      "missing_uf",
    );
  });
  it("mesma UF prevalece sobre o cadastro sem UF", () => {
    const others = [physician("12345", null), physician("12 345")];
    expect(findRegistrationDuplicate(others, scope)).toBe("same_uf");
  });
  it("mensagens distintas para cada caso", () => {
    expect(registrationDuplicateMessage("same_uf")).toBe(
      MEDICO_REGISTRATION_DUPLICATE_MESSAGE,
    );
    expect(registrationDuplicateMessage("missing_uf")).toBe(
      MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE,
    );
  });
});

describe("registrationIdentityChanged", () => {
  const stored = physician("12.345");
  it("só reformatar o número ou repetir a UF em minúscula não é mudança", () => {
    expect(registrationIdentityChanged(stored, physician("12345"))).toBe(false);
    expect(registrationIdentityChanged(stored, physician("12.345", "ma"))).toBe(false);
  });
  it("completar a UF de cadastro antigo não é mudança", () => {
    expect(registrationIdentityChanged(physician("12.345", null), stored)).toBe(false);
  });
  it("outro número, outra categoria ou troca de UF já informada é mudança", () => {
    expect(registrationIdentityChanged(stored, physician("12346"))).toBe(true);
    expect(registrationIdentityChanged(stored, physician("012345"))).toBe(true);
    expect(registrationIdentityChanged(stored, psychologist("12.345"))).toBe(true);
    expect(registrationIdentityChanged(stored, physician("12.345", "PI"))).toBe(true);
    expect(registrationIdentityChanged(physician("12345-MA"), physician("12345"))).toBe(
      true,
    );
  });
});

describe("countRegistrationDuplicateGroups", () => {
  it("conta grupos com UF repetida ou com cadastro sem UF; ignora não canônicos", () => {
    const rows = [
      physician("12.345"),
      physician("12345"),
      physician("22.222"),
      physician("22222", null),
      physician("33333"),
      physician("33.333", "PI"),
      psychologist("33333"),
      physician("44444-MA"),
      physician("44444"),
    ];
    expect(countRegistrationDuplicateGroups(rows)).toBe(2);
    expect(countRegistrationDuplicateGroups([])).toBe(0);
  });
});
