import { FREE_SIGNATURE_MONTHLY_QUOTA, isSignatureAvailable } from "@/shared/tenant/plan";

describe("signatures/quota (isSignatureAvailable)", () => {
  it("pro é sempre disponível, independente da contagem", () => {
    expect(isSignatureAvailable("pro", 0)).toBe(true);
    expect(isSignatureAvailable("pro", FREE_SIGNATURE_MONTHLY_QUOTA)).toBe(true);
    expect(isSignatureAvailable("pro", 9999)).toBe(true);
  });

  it("free disponível abaixo da quota e bloqueado a partir dela", () => {
    expect(isSignatureAvailable("free", 0)).toBe(true);
    expect(isSignatureAvailable("free", FREE_SIGNATURE_MONTHLY_QUOTA - 1)).toBe(true);
    expect(isSignatureAvailable("free", FREE_SIGNATURE_MONTHLY_QUOTA)).toBe(false);
    expect(isSignatureAvailable("free", FREE_SIGNATURE_MONTHLY_QUOTA + 5)).toBe(false);
  });
});
