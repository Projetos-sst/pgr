import {
  buildPgrDocumentTitle,
  pgrSignatureRequestSchema,
  derivePgrSignatureState,
} from "@/shared/domains/pgr/pgr-signature";

describe("buildPgrDocumentTitle", () => {
  it("compõe com a obra quando existe", () => {
    expect(buildPgrDocumentTitle({ companyName: "A Ltda", workUnitName: "Obra 1" })).toBe(
      "PGR — A Ltda · Obra 1",
    );
  });
  it("compõe só com a empresa quando não há obra", () => {
    expect(buildPgrDocumentTitle({ companyName: "A Ltda", workUnitName: null })).toBe(
      "PGR — A Ltda",
    );
  });
});

describe("pgrSignatureRequestSchema (.strict)", () => {
  it("aceita vazio e ttlSeconds inteiro positivo", () => {
    expect(pgrSignatureRequestSchema.safeParse({}).success).toBe(true);
    expect(pgrSignatureRequestSchema.safeParse({ ttlSeconds: 3600 }).success).toBe(true);
  });
  it("rejeita ttlSeconds <= 0, não-inteiro e campos extras", () => {
    expect(pgrSignatureRequestSchema.safeParse({ ttlSeconds: 0 }).success).toBe(false);
    expect(pgrSignatureRequestSchema.safeParse({ ttlSeconds: -1 }).success).toBe(false);
    expect(pgrSignatureRequestSchema.safeParse({ ttlSeconds: 1.5 }).success).toBe(false);
    expect(pgrSignatureRequestSchema.safeParse({ payload: {} }).success).toBe(false);
    expect(pgrSignatureRequestSchema.safeParse({ pgrId: "x" }).success).toBe(false);
  });
});

describe("derivePgrSignatureState", () => {
  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 3_600_000);
  it("sem linha → none", () => {
    expect(derivePgrSignatureState(null)).toBe("none");
  });
  it("pending não expirado → pending", () => {
    expect(derivePgrSignatureState({ status: "pending", expiresAt: future })).toBe(
      "pending",
    );
  });
  it("pending expirado → expired (derivado)", () => {
    expect(derivePgrSignatureState({ status: "pending", expiresAt: past })).toBe(
      "expired",
    );
  });
  it("signed / cancelled → passam direto", () => {
    expect(derivePgrSignatureState({ status: "signed", expiresAt: past })).toBe("signed");
    expect(derivePgrSignatureState({ status: "cancelled", expiresAt: past })).toBe(
      "cancelled",
    );
  });
});
