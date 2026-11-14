/** @jest-environment node */
jest.mock("@/shared/db/repositories/billing-checkout", () => ({}));
jest.mock("@/shared/server/commercial/commercial-core", () => ({}));
jest.mock("@/shared/integrations/stripe/client", () => ({}));

import { z } from "zod";

import { checkoutIdFor } from "@/shared/server/commercial/checkout-core";

describe("identificador do checkout", () => {
  it("é um UUID válido e estável para o mesmo escritório e a mesma chave", () => {
    const id = checkoutIdFor("org_a", "checkout-key-0000001");
    expect(z.uuid().safeParse(id).success).toBe(true);
    expect(checkoutIdFor("org_a", "checkout-key-0000001")).toBe(id);
  });

  it("muda com a chave e com o escritório", () => {
    const ids = new Set([
      checkoutIdFor("org_a", "checkout-key-0000001"),
      checkoutIdFor("org_a", "checkout-key-0000002"),
      checkoutIdFor("org_b", "checkout-key-0000001"),
    ]);
    expect(ids.size).toBe(3);
  });

  it("é UUID válido para qualquer chave", () => {
    for (let index = 0; index < 200; index += 1)
      expect(z.uuid().safeParse(checkoutIdFor("org", `chave-${index}`)).success).toBe(
        true,
      );
  });
});
