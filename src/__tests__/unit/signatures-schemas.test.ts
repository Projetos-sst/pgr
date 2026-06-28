import {
  createSignatureRequestSchema,
  publicSignatureSchema,
  signManuallySchema,
} from "@/shared/domains/signatures/schemas";
import { DEFAULT_SIGNATURE_TTL_SECONDS } from "@/shared/domains/signatures/token";

const pngDataUrl = (chars = 100) => `data:image/png;base64,${"A".repeat(chars)}`;

describe("signatures/schemas", () => {
  describe("createSignatureRequestSchema", () => {
    it("aceita demo válido e aplica ttl default", () => {
      const parsed = createSignatureRequestSchema.parse({
        targetType: "demo",
        payload: { title: "x" },
      });
      expect(parsed.ttlSeconds).toBe(DEFAULT_SIGNATURE_TTL_SECONDS);
    });

    it("rejeita target_type desconhecido", () => {
      expect(
        createSignatureRequestSchema.safeParse({ targetType: "nope", payload: {} })
          .success,
      ).toBe(false);
    });

    it("rejeita targetId não-uuid", () => {
      expect(
        createSignatureRequestSchema.safeParse({
          targetType: "demo",
          targetId: "not-a-uuid",
          payload: {},
        }).success,
      ).toBe(false);
    });
  });

  describe("publicSignatureSchema", () => {
    it("aceita PNG data-URL + nome", () => {
      expect(
        publicSignatureSchema.safeParse({
          signerName: "Fulano",
          imageDataUrl: pngDataUrl(),
        }).success,
      ).toBe(true);
    });

    it("rejeita nome vazio e nome > 120", () => {
      expect(
        publicSignatureSchema.safeParse({ signerName: "  ", imageDataUrl: pngDataUrl() })
          .success,
      ).toBe(false);
      expect(
        publicSignatureSchema.safeParse({
          signerName: "a".repeat(121),
          imageDataUrl: pngDataUrl(),
        }).success,
      ).toBe(false);
    });

    it("rejeita imagem não-PNG e imagem acima de 256 KB", () => {
      expect(
        publicSignatureSchema.safeParse({
          signerName: "Fulano",
          imageDataUrl: "data:image/jpeg;base64,AAAA",
        }).success,
      ).toBe(false);
      expect(
        publicSignatureSchema.safeParse({
          signerName: "Fulano",
          imageDataUrl: pngDataUrl(400_000),
        }).success,
      ).toBe(false);
    });
  });

  describe("signManuallySchema", () => {
    it("aceita nome válido, rejeita vazio", () => {
      expect(signManuallySchema.safeParse({ signerName: "Fulano" }).success).toBe(true);
      expect(signManuallySchema.safeParse({ signerName: "" }).success).toBe(false);
    });
  });
});
