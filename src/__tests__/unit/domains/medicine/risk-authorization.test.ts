import {
  companyAuthorizerSchema,
  professionalAuthorizationSchema,
  medicalRiskDecisionSchema,
} from "@/shared/domains/medicine/risk-authorization";
describe("company risk authorization input", () => {
  it("requires client nomination evidence and reason, including revocation", () => {
    expect(
      companyAuthorizerSchema.safeParse({
        userId: "login",
        evidence: "",
        reason: "indicação",
      }).success,
    ).toBe(false);
    expect(
      companyAuthorizerSchema.parse({
        userId: null,
        evidence: "Ata de substituição",
        reason: "Encerramento",
      }).userId,
    ).toBeNull();
  });
  it("requires professional identity and applicable registration without inventing a council", () => {
    const base = {
      userId: "professional",
      active: true,
      reason: "Indicado para a empresa",
      identity: {
        fullName: "Nome fictício",
        profession: "Profissão declarada",
        registration: { kind: "registered", council: "Órgão informado", number: "123" },
      },
    };
    expect(professionalAuthorizationSchema.safeParse(base).success).toBe(true);
    expect(
      professionalAuthorizationSchema.safeParse({
        ...base,
        identity: {
          ...base.identity,
          registration: { kind: "registered", council: "Órgão informado" },
        },
      }).success,
    ).toBe(false);
    expect(
      professionalAuthorizationSchema.safeParse({
        ...base,
        identity: {
          ...base.identity,
          registration: { kind: "not_applicable", reason: "Justificativa declarada" },
        },
      }).success,
    ).toBe(true);
  });
  it("does not require re-entering professional identity for revocation", () => {
    expect(
      professionalAuthorizationSchema.safeParse({
        userId: "professional",
        active: false,
        reason: "Revogado pela empresa",
      }).success,
    ).toBe(true);
  });
  it("requires a decision, reason, concurrency token and rejects forged actor fields", () => {
    const review = {
      status: "validated",
      reason: "Parecer registrado",
      expectedStatus: "pending",
      expectedReviewedAt: null,
    };
    expect(medicalRiskDecisionSchema.safeParse(review).success).toBe(true);
    expect(
      medicalRiskDecisionSchema.safeParse({ ...review, reviewedBy: "another" }).success,
    ).toBe(false);
    expect(medicalRiskDecisionSchema.safeParse({ ...review, reason: "" }).success).toBe(
      false,
    );
    expect(
      medicalRiskDecisionSchema.safeParse({ ...review, expectedReviewedAt: "yesterday" })
        .success,
    ).toBe(false);
  });
});

// NOB-112: sem mensagem própria, o texto padrão do Zod em inglês chegava à tela.
const ZOD_ENGLISH = /^(Invalid\b|Too (small|big)\b|Unrecognized key)/;
type IssuesLike = { error?: { issues: { path: PropertyKey[]; message: string }[] } };
const messagesOf = (result: IssuesLike) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );

describe("mensagens em português (sem texto padrão do Zod)", () => {
  it("indicação: evidência e motivo em branco", () => {
    const messages = messagesOf(
      companyAuthorizerSchema.safeParse({ userId: null, evidence: "", reason: " " }),
    );
    expect(messages).toEqual({
      evidence: "Informe a evidência da indicação da empresa.",
      reason: "Informe o motivo do registro ou da substituição.",
    });
  });

  it("autorização: identidade aninhada em branco e conta não selecionada", () => {
    const messages = messagesOf(
      professionalAuthorizationSchema.safeParse({
        userId: "",
        active: true,
        reason: "",
        identity: {
          fullName: "",
          profession: "",
          registration: { kind: "registered", council: "", number: "" },
        },
      }),
    );
    expect(messages).toMatchObject({
      userId: "Selecione a conta do profissional.",
      reason: "Informe o motivo da autorização ou da revogação.",
      "identity.fullName": "Informe o nome completo do profissional.",
      "identity.profession": "Informe a profissão.",
      "identity.registration.council": "Informe o conselho ou órgão de registro.",
      "identity.registration.number": "Informe o número do registro.",
    });
    for (const message of Object.values(messages)) expect(message).not.toMatch(ZOD_ENGLISH);
  });

  it("decisão: sem decisão, sem parecer e token de concorrência inválido", () => {
    const messages = messagesOf(
      medicalRiskDecisionSchema.safeParse({
        status: "",
        reason: "",
        expectedStatus: "x",
        expectedReviewedAt: "ontem",
      }),
    );
    expect(messages).toEqual({
      status: "Selecione a decisão técnica.",
      reason: "Registre o parecer e o motivo da decisão.",
      expectedStatus: "Atualize a página e tente novamente.",
      expectedReviewedAt: "Atualize a página e tente novamente.",
    });
  });

  it("limite de tamanho também em português", () => {
    const messages = messagesOf(
      companyAuthorizerSchema.safeParse({
        userId: null,
        evidence: "x".repeat(2001),
        reason: "ok",
      }),
    );
    expect(messages.evidence).toBe("Máximo de 2.000 caracteres.");
  });
});
