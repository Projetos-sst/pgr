import { isPgrEditLocked } from "@/shared/domains/pgr/pgr-lock";

describe("isPgrEditLocked", () => {
  const draft = { signatureState: "none" as const, publishedAt: null };

  it("rascunho sem assinatura é editável", () => {
    expect(isPgrEditLocked(draft)).toBe(false);
  });

  it("assinado trava", () => {
    expect(isPgrEditLocked({ ...draft, signatureState: "signed" })).toBe(true);
  });

  it("publicado trava mesmo com a assinatura fora de `signed`", () => {
    // Publicação é irreversível: uma solicitação posterior expirar/ser cancelada
    // não pode reabrir para edição um documento que já foi publicado.
    expect(isPgrEditLocked({ signatureState: "expired", publishedAt: new Date() })).toBe(
      true,
    );
  });

  it("pending/expired/cancelled sem publicação seguem editáveis", () => {
    for (const state of ["pending", "expired", "cancelled"] as const) {
      expect(isPgrEditLocked({ ...draft, signatureState: state })).toBe(false);
    }
  });
});
