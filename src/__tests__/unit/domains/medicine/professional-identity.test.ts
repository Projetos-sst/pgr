/**
 * Identidade profissional (NOB-158/159): situação derivada, validade configurável, entrada do
 * operador (checklist completo) e desafio de controle da conta. Fictício.
 */
import {
  CHALLENGE_LIMITS,
  challengeAttemptsLeft,
  challengeLock,
  identityApprovalSchema,
  identityStatus,
  identityValidityMonths,
  reconfirmationStatement,
} from "@/shared/domains/medicine/professional-identity";
import {
  CHALLENGE_WINDOW_MS,
  challengeMatches,
  currentChallengeCode,
} from "@/shared/server/medicine/identity-challenge";

jest.mock("server-only", () => ({}));

const NOW = "2026-11-03T12:00:00.000Z";
const REQ = "11111111-1111-4111-8111-111111111111";

describe("identityStatus", () => {
  const verification = (overrides = {}) => ({
    requestId: REQ,
    expiresAt: "2027-11-03T12:00:00.000Z",
    revoked: false,
    registryMatches: true,
    ...overrides,
  });
  it("sem pedido: pendente; pedido aberto: em análise; recusado: recusado", () => {
    expect(identityStatus({ lastRequest: null, lastVerification: null, now: NOW })).toBe(
      "not_requested",
    );
    expect(
      identityStatus({
        lastRequest: { id: REQ, rejected: false },
        lastVerification: null,
        now: NOW,
      }),
    ).toBe("in_review");
    expect(
      identityStatus({
        lastRequest: { id: REQ, rejected: true },
        lastVerification: null,
        now: NOW,
      }),
    ).toBe("rejected");
  });
  it("verificada só sem revogação, dentro da validade e com CRM/UF iguais ao cadastro", () => {
    const r = { id: REQ, rejected: false };
    expect(
      identityStatus({ lastRequest: r, lastVerification: verification(), now: NOW }),
    ).toBe("verified");
    expect(
      identityStatus({
        lastRequest: r,
        lastVerification: verification({ revoked: true }),
        now: NOW,
      }),
    ).toBe("revoked");
    expect(
      identityStatus({
        lastRequest: r,
        lastVerification: verification({ expiresAt: "2026-01-01T00:00:00.000Z" }),
        now: NOW,
      }),
    ).toBe("expired");
    expect(
      identityStatus({
        lastRequest: r,
        lastVerification: verification({ registryMatches: false }),
        now: NOW,
      }),
    ).toBe("expired");
  });
  it("pedido novo depois de uma verificação volta a ficar em análise", () => {
    expect(
      identityStatus({
        lastRequest: { id: "outro", rejected: false },
        lastVerification: verification({ revoked: true }),
        now: NOW,
      }),
    ).toBe("in_review");
  });
});

describe("identityValidityMonths", () => {
  it("padrão 12, teto 36, valores inválidos voltam ao padrão", () => {
    expect(identityValidityMonths(undefined)).toBe(12);
    expect(identityValidityMonths("6")).toBe(6);
    expect(identityValidityMonths("120")).toBe(36);
    expect(identityValidityMonths("0")).toBe(12);
    expect(identityValidityMonths("abc")).toBe(12);
  });
});

describe("identityApprovalSchema", () => {
  const valid = {
    requestId: REQ,
    method: "in_person",
    crm: "1234",
    registrationUf: "ma",
    registrySource: "Consulta pública fictícia",
    challengeCode: "123456",
    checklist: {
      identityDocument: true,
      professionalDocument: true,
      registryStatus: true,
      personMatches: true,
      accountControl: true,
    },
  };
  it("exige checklist completo, método, fonte e código; normaliza a UF", () => {
    expect(identityApprovalSchema.parse(valid).registrationUf).toBe("MA");
    expect(
      identityApprovalSchema.safeParse({
        ...valid,
        checklist: { ...valid.checklist, accountControl: false },
      }).success,
    ).toBe(false);
    expect(identityApprovalSchema.safeParse({ ...valid, method: "selfie" }).success).toBe(
      false,
    );
    expect(
      identityApprovalSchema.safeParse({ ...valid, challengeCode: "12a" }).success,
    ).toBe(false);
    expect(
      identityApprovalSchema.safeParse({ ...valid, verifiedBy: "owner" }).success,
    ).toBe(false);
  });
});

describe("desafio de controle da conta", () => {
  const original = process.env.IDENTITY_CHALLENGE_SECRET;
  afterEach(() => {
    process.env.IDENTITY_CHALLENGE_SECRET = original;
  });
  it("sem segredo: indisponível; com segredo: confere na janela atual e na anterior, recusa outra conta", () => {
    delete process.env.IDENTITY_CHALLENGE_SECRET;
    expect(currentChallengeCode(REQ, "u1")).toBeNull();
    expect(challengeMatches(REQ, "u1", "123456")).toBe(false);
    process.env.IDENTITY_CHALLENGE_SECRET = "segredo-ficticio";
    const t = Date.UTC(2026, 10, 3, 12, 0, 0);
    const code = currentChallengeCode(REQ, "u1", t)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(challengeMatches(REQ, "u1", code, t)).toBe(true);
    // Janela de 5 min (NOB-164): vale na janela atual e na seguinte; duas janelas depois, não.
    expect(CHALLENGE_WINDOW_MS).toBe(5 * 60 * 1000);
    const start = Math.floor(t / CHALLENGE_WINDOW_MS) * CHALLENGE_WINDOW_MS;
    expect(challengeMatches(REQ, "u1", code, start + CHALLENGE_WINDOW_MS)).toBe(true);
    expect(challengeMatches(REQ, "u1", code, start + 2 * CHALLENGE_WINDOW_MS - 1)).toBe(
      true,
    );
    expect(challengeMatches(REQ, "u1", code, start + 2 * CHALLENGE_WINDOW_MS)).toBe(
      false,
    );
    expect(challengeMatches(REQ, "u1", code, t + 11 * 60 * 1000)).toBe(false);
    expect(challengeMatches(REQ, "outra-conta", code, t)).toBe(false);
  });
  it("declaração de reconfirmação usa o cadastro", () => {
    expect(
      reconfirmationStatement({ name: "Dra. Fictícia", registration: "CRM 1/MA" }),
    ).toContain("Dra. Fictícia, CRM 1/MA");
  });
});

describe("limites do desafio", () => {
  const zero = { request: 0, account24h: 0, verifier1h: 0 };
  it("libera abaixo dos limites e trava no limite, pedido antes de conta e de operador", () => {
    expect(challengeLock(zero)).toBeNull();
    expect(challengeLock({ request: 4, account24h: 9, verifier1h: 9 })).toBeNull();
    expect(challengeLock({ ...zero, request: CHALLENGE_LIMITS.perRequest })).toBe(
      "request",
    );
    expect(challengeLock({ ...zero, account24h: CHALLENGE_LIMITS.perAccount24h })).toBe(
      "account",
    );
    expect(challengeLock({ ...zero, verifier1h: CHALLENGE_LIMITS.perVerifier1h })).toBe(
      "verifier",
    );
    expect(challengeLock({ request: 5, account24h: 10, verifier1h: 10 })).toBe("request");
  });
  it("tentativas restantes no pedido nunca ficam negativas", () => {
    expect(challengeAttemptsLeft(1)).toBe(4);
    expect(challengeAttemptsLeft(5)).toBe(0);
    expect(challengeAttemptsLeft(9)).toBe(0);
  });
});
