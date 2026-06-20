import {
  companyInputSchema,
  toCompanyListItem,
} from "@/shared/domains/pgr/companies";
import type { Company } from "@/shared/db/schema";

describe("companyInputSchema (US1)", () => {
  const base = { razaoSocial: "Acme Ltda", riskGrade: "2" };

  it("aceita entrada mínima válida e coage riskGrade para número", () => {
    const parsed = companyInputSchema.parse(base);
    expect(parsed.razaoSocial).toBe("Acme Ltda");
    expect(parsed.riskGrade).toBe(2);
  });

  it("exige razão social não-vazia", () => {
    expect(() => companyInputSchema.parse({ ...base, razaoSocial: "  " })).toThrow();
  });

  it.each(["0", "5", "9"])("rejeita riskGrade fora de 1..4 (%s)", (riskGrade) => {
    expect(() => companyInputSchema.parse({ ...base, riskGrade })).toThrow();
  });

  it("aceita CNPJ vazio (opcional) → undefined", () => {
    expect(companyInputSchema.parse({ ...base, cnpj: "" }).cnpj).toBeUndefined();
  });

  it("normaliza CNPJ válido e rejeita formato inválido", () => {
    expect(companyInputSchema.parse({ ...base, cnpj: "11.222.333/0001-81" }).cnpj).toBe(
      "11222333000181",
    );
    expect(() => companyInputSchema.parse({ ...base, cnpj: "123" })).toThrow();
  });

  it("converte strings de endereço vazias em undefined", () => {
    const parsed = companyInputSchema.parse({ ...base, city: "", state: "SP" });
    expect(parsed.city).toBeUndefined();
    expect(parsed.state).toBe("SP");
  });
});

describe("toCompanyListItem", () => {
  it("projeta apenas as colunas da lista", () => {
    const row = {
      id: "c1",
      razaoSocial: "Acme",
      cnpj: "11222333000181",
      city: "São Paulo",
      state: "SP",
      nomeFantasia: "Acme",
    } as unknown as Company;
    expect(toCompanyListItem(row)).toEqual({
      id: "c1",
      razaoSocial: "Acme",
      cnpj: "11222333000181",
      city: "São Paulo",
      state: "SP",
    });
  });
});
