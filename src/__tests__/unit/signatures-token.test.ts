import {
  DEFAULT_SIGNATURE_TTL_SECONDS,
  computeExpiresAt,
  generateToken,
  hashToken,
  isExpired,
} from "@/shared/domains/signatures/token";

describe("signatures/token", () => {
  describe("generateToken", () => {
    it("gera tokens não vazios e únicos", () => {
      const a = generateToken();
      const b = generateToken();
      expect(a.length).toBeGreaterThanOrEqual(40); // 32 bytes base64url ≈ 43 chars
      expect(a).not.toEqual(b);
      expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    });
  });

  describe("hashToken", () => {
    it("é determinístico e hex de 64 chars (sha-256)", () => {
      const raw = "some-token";
      expect(hashToken(raw)).toEqual(hashToken(raw));
      expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("difere para entradas diferentes e nunca devolve o token cru", () => {
      const raw = generateToken();
      const hashed = hashToken(raw);
      expect(hashed).not.toEqual(raw);
      expect(hashToken("a")).not.toEqual(hashToken("b"));
    });
  });

  describe("computeExpiresAt", () => {
    it("soma o TTL ao instante base; default = 72h", () => {
      const from = new Date("2026-06-28T00:00:00.000Z");
      expect(computeExpiresAt(60, from).toISOString()).toBe("2026-06-28T00:01:00.000Z");
      expect(computeExpiresAt(undefined, from).getTime()).toBe(
        from.getTime() + DEFAULT_SIGNATURE_TTL_SECONDS * 1000,
      );
    });
  });

  describe("isExpired", () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const past = new Date("2026-06-28T11:00:00.000Z");
    const future = new Date("2026-06-28T13:00:00.000Z");

    it("pending + expirado no passado → true", () => {
      expect(isExpired(past, "pending", now)).toBe(true);
    });
    it("pending + futuro → false", () => {
      expect(isExpired(future, "pending", now)).toBe(false);
    });
    it("signed/cancelled nunca expira, mesmo no passado", () => {
      expect(isExpired(past, "signed", now)).toBe(false);
      expect(isExpired(past, "cancelled", now)).toBe(false);
    });
  });
});
