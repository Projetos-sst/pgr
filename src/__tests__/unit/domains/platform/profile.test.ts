import { profileInputSchema } from "@/shared/domains/platform/profile";

describe("profileInputSchema", () => {
  it("aceita CPF de 11 dígitos e normaliza para dígitos", () => {
    const result = profileInputSchema.safeParse({
      cpf: "123.456.789-09",
      phone: "11999998888",
      jobTitle: "Técnico de Segurança",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cpf).toBe("12345678909");
  });

  it("CPF vazio vira undefined (opcional)", () => {
    const result = profileInputSchema.safeParse({ cpf: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cpf).toBeUndefined();
  });

  it("rejeita CPF com dígitos insuficientes", () => {
    expect(profileInputSchema.safeParse({ cpf: "123" }).success).toBe(false);
  });

  it("todos os campos ausentes → válido (perfil pode ficar vazio)", () => {
    expect(profileInputSchema.safeParse({}).success).toBe(true);
  });
});
