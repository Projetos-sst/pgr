import {
  PROVISIONAL_TRIAL_POLICY,
  emissionAccess,
  trialInputSchema,
  trialStatus,
  trialWindow,
} from "@/shared/domains/commercial/trial";

const startedAt = new Date("2026-11-01T12:00:00Z");
const { endsAt } = trialWindow(startedAt, PROVISIONAL_TRIAL_POLICY.days);
const running = { endsAt, convertedAt: null };
const during = new Date("2026-11-10T00:00:00Z");
const after = new Date("2026-12-10T00:00:00Z");

describe("política provisória", () => {
  it("usa 15 dias e não exige cartão", () => {
    expect(PROVISIONAL_TRIAL_POLICY).toEqual({ days: 15, requiresCard: false });
  });
});

describe("trialWindow", () => {
  it("soma os dias ao início", () => {
    expect(endsAt.toISOString()).toBe("2026-11-16T12:00:00.000Z");
    expect(trialWindow(startedAt, 1).endsAt.toISOString()).toBe(
      "2026-11-02T12:00:00.000Z",
    );
  });
});

describe("trialStatus", () => {
  it("ativo antes do fim", () => {
    expect(trialStatus(running, new Date("2026-11-15T23:59:59Z"))).toBe("active");
  });
  it("expirado no instante do fim e depois", () => {
    expect(trialStatus(running, endsAt)).toBe("expired");
    expect(trialStatus(running, after)).toBe("expired");
  });
  it("convertido prevalece sobre o relógio", () => {
    const converted = { endsAt, convertedAt: new Date("2026-11-05T00:00:00Z") };
    expect(trialStatus(converted, new Date("2027-01-01T00:00:00Z"))).toBe("converted");
  });
});

describe("emissionAccess", () => {
  it("sem registro de teste permite", () => {
    expect(emissionAccess({ trial: null, hasPaidPgr: false, now: during })).toEqual({
      allowed: true,
    });
  });
  it("teste ativo sem PGR pago bloqueia", () => {
    const result = emissionAccess({ trial: running, hasPaidPgr: false, now: during });
    expect(result.allowed).toBe(false);
  });
  it("teste expirado sem PGR pago bloqueia com motivo", () => {
    const result = emissionAccess({ trial: running, hasPaidPgr: false, now: after });
    expect(result).toMatchObject({ allowed: false });
    expect(result.allowed === false && result.reason).toMatch(/após a contratação/);
  });
  it("PGR pago libera em teste ativo ou expirado", () => {
    expect(emissionAccess({ trial: running, hasPaidPgr: true, now: during })).toEqual({
      allowed: true,
    });
    expect(emissionAccess({ trial: running, hasPaidPgr: true, now: after })).toEqual({
      allowed: true,
    });
  });
  it("só Medicina paga equivale a não ter PGR pago e não libera", () => {
    const onlyMedicinePaid = { pgr: false, medicine: true };
    const result = emissionAccess({
      trial: running,
      hasPaidPgr: onlyMedicinePaid.pgr,
      now: after,
    });
    expect(result.allowed).toBe(false);
  });
  it("teste convertido libera", () => {
    const converted = { endsAt, convertedAt: during };
    expect(emissionAccess({ trial: converted, hasPaidPgr: false, now: after })).toEqual({
      allowed: true,
    });
  });
});

describe("trialInputSchema", () => {
  it("aceita só companyId", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    expect(trialInputSchema.safeParse({ companyId }).success).toBe(true);
    expect(trialInputSchema.safeParse({ companyId, days: 1 }).success).toBe(false);
    expect(trialInputSchema.safeParse({ companyId: "x" }).success).toBe(false);
  });
});
